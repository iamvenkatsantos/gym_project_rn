import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: ThemeColor;
};

export function Icon({ name, size = 18, color = 'textSecondary' }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={theme[color]} />;
}
