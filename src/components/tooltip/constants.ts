import { EVENT_CODE } from '../../constants';

export const triggerMap: Record<string, string> = {
  hover: 'mouseenter',
  focus: 'focusin',
  click: 'click',
  contextmenu: 'manual',
};

export const defaultTriggerKeys = [
  EVENT_CODE.enter,
  EVENT_CODE.numpadEnter,
  EVENT_CODE.space,
];

export const TOOLTIP_OPTIONS_DEFAULTS = {
  trigger: 'hover' as const,
  showAfter: 0,
  hideAfter: 200,
  autoClose: 0,
  placement: 'bottom' as const,
  offset: [0, 12] as [number, number],
  enterable: true,
  effect: 'dark' as const,
  transition: 'fade' as const,
  showArrow: true,
  appendTo: document.body,
  hideOnClick: true,
  zIndex: 2000,
  maxWidth: 360,
  strategy: 'fixed' as const,
  gpuAcceleration: true,
  disabled: false,
  rawContent: false,
  teleported: true,
  persistent: false,
};
