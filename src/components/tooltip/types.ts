import type { Props } from 'tippy.js';

export type TooltipTriggerType = 'hover' | 'focus' | 'click' | 'contextmenu';

export interface ZaneTooltipProps {
  trigger?: TooltipTriggerType | TooltipTriggerType[];
  triggerKeys?: string[];
  disabled?: boolean;
  content?: string;
  rawContent?: boolean;
  placement?: Props['placement'];
  offset?: [number, number];
  showAfter?: number;
  hideAfter?: number;
  autoClose?: number;
  enterable?: boolean;
  effect?: 'dark' | 'light';
  transition?: string;
  showArrow?: boolean;
  popperClass?: string;
  popperStyle?: Record<string, any>;
  teleported?: boolean;
  appendTo?: HTMLElement | string;
  persistent?: boolean;
  visible?: boolean;
  hideOnClick?: boolean;
  zIndex?: number;
  maxWidth?: number | string;
  ariaLabel?: string;
  virtualRef?: HTMLElement | { getBoundingClientRect: () => DOMRect };
  virtualTriggering?: boolean;
  focusOnTarget?: boolean;
  fallbackPlacements?: string[];
  strategy?: 'absolute' | 'fixed';
  gpuAcceleration?: boolean;
}

export interface TooltipEvents {
  onShow?: () => void;
  onHide?: () => void;
  onBeforeShow?: () => void;
  onBeforeHide?: () => void;
  'onUpdate:visible'?: (visible: boolean) => void;
}
