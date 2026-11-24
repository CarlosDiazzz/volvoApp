# volvoApp

Nodo sensor móvil del reto Volvo Buses (HackaTec 2026): app **Expo / React Native** que mide con los sensores reales del
celular y envía cada muestra **cifrada de extremo a extremo** al sistema.

```
mobile/   app Expo (SDK 58, iOS y Android)
bridge/   puente en Python (FastAPI): relevo NO confiable; no puede leer, alterar ni falsificar muestras
```

Se despliega desde `volvoInfra` (`make up`). El contrato de la muestra cifrada y los vectores de prueba están en
`volvoInfra/spec/` (`make spec` los copia aquí).

## Qué mide cada plataforma

| Variable de carrocería | Sensor | Android | iOS |
|---|---|---|---|
| Compresor del A/C (vibración) | Acelerómetro (MEMS) | sí | sí |
| Puerta del sanitario | Magnetómetro (imán, equivale a un reed switch) o botón manual | sí | sí |
| Iluminación interior | Sensor de luz ambiente | sí | **no** (iOS no lo expone) |
| Batería / consumo | `expo-battery` | sí | sí (dispositivo físico) |

Son **proxies** de consumo, sin calibrar: el celular es un nodo de referencia, no el sensor de producción.
Pendiente: nivel de ruido (micrófono, solo dB) y banda muerta de envío.

## Modo conductor (vista para CarPlay)

Pantalla para el conductor dentro de la misma app: muestra el **estado de mantenimiento** de la carrocería en un
**carrusel** (una tarjeta por componente, con valor clave, recomendación en lenguaje llano, tendencia y nivel:
*Sin acción*, *Programar servicio*, *Atender ya* o *Sin datos*). Omite lo que solo describe el momento (pasajeros,
puertas abiertas ahora, luz exterior). Se abre con **Abrir modo conductor** (con o sin emparejar), gira a horizontal y
mantiene la pantalla encendida. Identidad de Volvo en tema claro; tipografía del sistema (SF Pro / Roboto), la que
exige CarPlay.

| Volvo 9800 (foráneo) | Volvo 7800 Electric (biarticulado) |
|---|---|
| Compresor del A/C (vibración y tendencia) · Rendimiento del A/C | Servicio de puertas (ciclos restantes) · Unidades de clima |
| Circuito de iluminación (consumo vs. esperado) · Tanque del sanitario | Batería de 24 V · Convertidor DC/DC · Iluminación |
| Sensores de carrocería (cuántos reportan) | Sensores de carrocería |

**Datos:** por ahora **simulados en el propio celular** (la pantalla lo dice siempre). Tocar el modelo en la barra
superior alterna entre los dos perfiles del simulador de volvoFirmware. Cada perfil cuenta una historia de fallas que se
repite para la demo (lámpara fundida, vibración del compresor, A/C sin enfriar; unidad de clima caída, DC/DC apagado,
servicio de puertas).

**Conectar datos reales (pendiente):** implementar otra `TelemetrySource` en `src/domain/driver/` que reciba los
mensajes `telemetry` del gateway y los aplique con `applyTelemetry` (ya valida el contrato y descarta lo que no cumple
o es de otra unidad). Ojo: hoy la app **solo envía**; recibir datos de la unidad cambia el modelo de seguridad y debe
definirse con el equipo (lectura solo de la unidad emparejada, autenticada, sin datos de otras unidades).

**CarPlay nativo (pendiente):** Expo no tiene soporte oficial de CarPlay ni Android Auto. Para la pantalla del vehículo
se necesita el *entitlement* de CarPlay que otorga Apple (categoría *driving task*), una *development build* y una
biblioteca nativa de plantillas (CarPlay no permite interfaces libres: lista, información o cuadrícula). La lógica de
`src/domain/driver/` (catálogo, umbrales, textos, niveles) no depende de la interfaz y se reutiliza tal cual para
armar esas plantillas.

## Seguridad

- **Cifrado extremo a extremo:** cada muestra se cifra en el celular con AES-256-GCM (clave propia, nonce = prefijo + contador, AAD ligada
  a dispositivo y autobús). Solo el backend descifra. El puente y el broker ven únicamente el sobre cifrado.
- **Contador persistente por bloques** en el Keychain/Keystore: el nonce nunca se repite, ni siquiera tras reiniciar la app.
- **Emparejamiento:** el enlace de `make phone` lleva la clave del dispositivo; se guarda en `expo-secure-store`
  (solo con el equipo desbloqueado, sin respaldo a la nube).
- **Puente:** autentica al celular con un token por dispositivo, limita la tasa, valida la forma del sobre, filtra contadores repetidos,
  bloquea una IP tras 5 autenticaciones fallidas y registra todo en una bitácora con hash encadenado (sin tokens ni contenido).
- La app **solo envía**. No recibe datos de flota (el modo conductor usa, por ahora, datos simulados en el propio celular). No captura imágenes ni audio.

## Estructura (separación de responsabilidades)

```
mobile/src/
  domain/      lógica pura sin React Native: medición, contador, cifrado, emparejamiento, muestra (probada con los vectores)
  services/    efectos externos: enlace WSS, almacenamiento seguro
  hooks/       pegamento con React: usePairing, useSensors, useBattery, useCapture
  components/  piezas visuales sin lógica
  domain/driver/  modo conductor: contrato de telemetría, simulador de los perfiles, historial y catálogo de mantenimiento
  components/driver/  piezas visuales del modo conductor (tarjeta, carrusel, barra, aviso)
  screens/     pantallas que componen hooks y componentes (Emparejamiento, Captura, Modo conductor)
bridge/app/
  api/ application/ adapters/ domain/ security/   puente por capas (puertos y adaptadores)
```

## Pruebas

```bash
cd bridge && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && pytest   # 13 pruebas
cd mobile && npm install && npm test && npm run typecheck                                                  # 28 pruebas + tsc
```

## Correr la app

```bash
cd mobile && npx expo start   # escanear el QR con Expo Go
```

**Confianza TLS (importante):** el puente usa una CA privada.
- **iOS + Expo Go:** instale la CA (`make ca` en volvoInfra) y active *Confianza de certificados*.
- **Android:** Expo Go **no** acepta CAs instaladas por el usuario. Compile la app propia (`npx expo run:android`); el plugin
  `plugins/withDevCaTrust.js` hace que confíe en la CA instalada. **Solo desarrollo**: en producción, certificado de CA pública o CA fijada.

La captura requiere la app abierta y la pantalla encendida (la app la mantiene activa): el sistema suspende los sensores en segundo plano.

## Pendiente

- Probar en dispositivos reales (verificado con pruebas, typecheck y la prueba de punta a punta de `make smoke`, no en un celular).
- Escaneo de QR para el emparejamiento (hoy se pega el enlace).
- Ruido (micrófono), banda muerta y asistente de verificación del sensor.
