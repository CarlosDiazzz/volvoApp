import { useAppearance } from './AppearanceProvider';

/** Relleno del contenido de una vista con desplazamiento: 24 px, o la zona segura + 8 px si es mayor (esquinas y bordes curvos). */
export function useContentPadding() {
  const { insets } = useAppearance();
  return { paddingLeft: Math.max(24, insets.left + 8), paddingRight: Math.max(24, insets.right + 8), paddingBottom: 24 };
}
