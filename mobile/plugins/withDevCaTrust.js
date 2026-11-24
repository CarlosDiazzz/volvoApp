// SOLO DESARROLLO. Permite que la app (compilación propia) confíe en la CA que el
// usuario instaló en el celular, necesaria para el WSS con la CA privada de volvoInfra.
// Expo Go en Android NO la acepta: use `npx expo run:android` o `eas build --profile development`.
// En producción: sustituir por un certificado de CA pública o fijar la CA (res/raw).
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

module.exports = (config) => {
  config = withAndroidManifest(config, (c) => {
    c.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return c;
  });
  return withDangerousMod(config, ['android', (c) => {
    const dir = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'network_security_config.xml'), XML);
    return c;
  }]);
};
