import { memo } from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

type Props = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
};

export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  duration
}: Props) {
  const display = useAnimatedNumber(value, duration);
  return (
    <span className={className}>
      {prefix}{display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}{suffix}
    </span>
  );
});
