import {
  Component,
  Element,
  Event,
  type EventEmitter,
  h,
  Host,
  Listen,
  Method,
  Prop,
  Watch,
} from '@stencil/core';
import tippy, { type Instance, type Props } from 'tippy.js';
import { useNamespace } from '../../hooks';
import { triggerMap, TOOLTIP_OPTIONS_DEFAULTS } from './constants';

import type { TooltipTriggerType } from './types';

@Component({
  tag: 'zane-tooltip',
  styleUrl: 'zane-tooltip.scss',
  shadow: false,
})
export class ZaneTooltip {
  @Element() el!: HTMLElement;

  private tippyInstance?: Instance;
  private autoCloseTimer?: number;
  private hasContentSlot = false;

  @Prop() trigger: TooltipTriggerType | TooltipTriggerType[] =
    TOOLTIP_OPTIONS_DEFAULTS.trigger;

  @Prop() disabled: boolean = TOOLTIP_OPTIONS_DEFAULTS.disabled;

  @Prop() content?: string;

  @Prop() rawContent: boolean = TOOLTIP_OPTIONS_DEFAULTS.rawContent;

  @Prop() placement: string = TOOLTIP_OPTIONS_DEFAULTS.placement;

  @Prop({ mutable: true }) offset: string | [number, number] =
    TOOLTIP_OPTIONS_DEFAULTS.offset;

  @Prop() showAfter: number = TOOLTIP_OPTIONS_DEFAULTS.showAfter;

  @Prop() hideAfter: number = TOOLTIP_OPTIONS_DEFAULTS.hideAfter;

  @Prop() autoClose: number = TOOLTIP_OPTIONS_DEFAULTS.autoClose;

  @Prop() enterable: boolean = TOOLTIP_OPTIONS_DEFAULTS.enterable;

  @Prop() effect: string = TOOLTIP_OPTIONS_DEFAULTS.effect;

  @Prop() transition: string = TOOLTIP_OPTIONS_DEFAULTS.transition;

  @Prop() showArrow: boolean = TOOLTIP_OPTIONS_DEFAULTS.showArrow;

  @Prop() popperClass?: string;

  @Prop() popperStyle?: Record<string, any>;

  @Prop() teleported: boolean = TOOLTIP_OPTIONS_DEFAULTS.teleported;

  @Prop() appendTo: HTMLElement | 'parent' | ((ref: Element) => Element) =
    TOOLTIP_OPTIONS_DEFAULTS.appendTo;

  @Prop() hideOnClick: boolean = TOOLTIP_OPTIONS_DEFAULTS.hideOnClick;

  @Prop() zIndex: number = TOOLTIP_OPTIONS_DEFAULTS.zIndex;

  @Prop() maxWidth: number | string = TOOLTIP_OPTIONS_DEFAULTS.maxWidth;

  @Prop({ mutable: true }) visible?: boolean;

  @Event({ eventName: 'zBeforeShow' })
  beforeShowEvent!: EventEmitter<void>;

  @Event({ eventName: 'zShow' })
  showEvent!: EventEmitter<void>;

  @Event({ eventName: 'zBeforeHide' })
  beforeHideEvent!: EventEmitter<void>;

  @Event({ eventName: 'zHide' })
  hideEvent!: EventEmitter<void>;

  @Event({ eventName: 'zVisibleChange' })
  visibleChange!: EventEmitter<boolean>;

  private get isControlled(): boolean {
    return this.visible !== undefined;
  }

  private get triggers(): TooltipTriggerType[] {
    return Array.isArray(this.trigger) ? this.trigger : [this.trigger];
  }

  private get hasContextmenuTrigger(): boolean {
    return this.triggers.includes('contextmenu');
  }

  private get parsedOffset(): [number, number] {
    if (Array.isArray(this.offset)) {
      return this.offset;
    }
    try {
      const parsed = JSON.parse(this.offset);
      if (Array.isArray(parsed) && parsed.length === 2) {
        return [Number(parsed[0]), Number(parsed[1])];
      }
    } catch {
      // fallback
    }
    return TOOLTIP_OPTIONS_DEFAULTS.offset;
  }

  private get tippyTrigger(): string {
    if (this.isControlled) return 'manual';

    const remaining = this.hasContextmenuTrigger
      ? this.triggers.filter((t) => t !== 'contextmenu')
      : this.triggers;

    if (remaining.length === 0) return 'manual';
    return remaining.map((t) => triggerMap[t] || t).join(' ');
  }

  @Watch('visible')
  onVisibleChange(newVal: boolean | undefined) {
    if (newVal === undefined) return;
    if (newVal) {
      this.show();
    } else {
      this.hide();
    }
  }

  @Watch('disabled')
  onDisabledChange(newVal: boolean) {
    if (!this.tippyInstance) return;
    if (newVal) {
      this.tippyInstance.disable();
    } else {
      this.tippyInstance.enable();
    }
  }

  @Watch('content')
  onContentChange() {
    if (this.tippyInstance) {
      this.tippyInstance.setContent(this.getContentValue());
    }
  }

  @Watch('offset')
  @Watch('placement')
  @Watch('showAfter')
  @Watch('hideAfter')
  @Watch('enterable')
  @Watch('hideOnClick')
  @Watch('transition')
  @Watch('effect')
  @Watch('showArrow')
  @Watch('zIndex')
  @Watch('maxWidth')
  @Watch('rawContent')
  onTippyPropsChange() {
    if (this.tippyInstance) {
      this.tippyInstance.setProps(this.getTippyProps());
    }
  }

  @Listen('contextmenu', { capture: true })
  onContextMenu(event: MouseEvent) {
    if (this.disabled) return;
    if (!this.hasContextmenuTrigger && !this.isControlled) return;

    event.preventDefault();
    this.toggle();
  }

  componentWillLoad() {
    this.hasContentSlot = !!this.el.querySelector('[slot="content"]');
  }

  componentDidLoad() {
    this.initializeTippy();
  }

  disconnectedCallback() {
    this.destroyTippy();
    this.clearAutoClose();
  }

  @Method()
  async show() {
    if (this.isControlled && !this.visible) {
      this.emitVisibleChange(true);
      return;
    }
    if (this.tippyInstance) {
      this.beforeShowEvent.emit();
      this.tippyInstance.show();
    }
  }

  @Method()
  async hide() {
    if (this.isControlled && this.visible) {
      this.emitVisibleChange(false);
      return;
    }
    if (this.tippyInstance) {
      this.beforeHideEvent.emit();
      this.tippyInstance.hide();
    }
  }

  @Method()
  async toggle() {
    if (this.isControlled) {
      this.emitVisibleChange(!this.visible);
      return;
    }
    if (this.tippyInstance) {
      if (this.tippyInstance.state.isVisible) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  private emitVisibleChange(value: boolean) {
    this.visibleChange.emit(value);
    this.visible = value;
  }

  private getContentValue(): string | HTMLElement {
    const slot = this.el.querySelector('[slot="content"]') as HTMLElement | null;
    if (slot) {
      return slot;
    }
    if (this.content) {
      return this.content;
    }
    return '';
  }

  private getTippyProps(): Partial<Props> {
    return {
      placement: this.placement as Props['placement'],
      offset: this.parsedOffset,
      delay: [this.showAfter, this.hideAfter],
      trigger: this.tippyTrigger,
      interactive: this.enterable,
      hideOnClick: this.triggers.includes('click') ? this.hideOnClick : false,
      animation: (this.transition || 'fade') as Props['animation'],
      theme: this.effect,
      arrow: this.showArrow,
      zIndex: this.zIndex,
      appendTo: this.appendTo,
      allowHTML: this.rawContent,
      content: this.getContentValue(),
      onShow: () => {
        this.beforeShowEvent.emit();
      },
      onShown: () => {
        this.showEvent.emit();
        this.startAutoClose();
      },
      onHide: () => {
        this.beforeHideEvent.emit();
      },
      onHidden: () => {
        this.hideEvent.emit();
        this.clearAutoClose();
      },
    };
  }

  private initializeTippy() {
    const target = this.el;
    const props = this.getTippyProps();

    this.tippyInstance = tippy(target, props);

    if (this.isControlled && this.visible) {
      this.tippyInstance.show();
    }
  }

  private destroyTippy() {
    if (this.tippyInstance) {
      this.tippyInstance.destroy();
      this.tippyInstance = undefined;
    }
  }

  private startAutoClose() {
    this.clearAutoClose();
    if (this.autoClose > 0) {
      this.autoCloseTimer = window.setTimeout(() => {
        this.hide();
      }, this.autoClose);
    }
  }

  private clearAutoClose() {
    if (this.autoCloseTimer !== undefined) {
      window.clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = undefined;
    }
  }

  render() {
    const ns = useNamespace('tooltip');

    return (
      <Host class={ns.b()}>
        <slot />
        {this.hasContentSlot && (
          <div style={{ display: 'none' }}>
            <slot name="content" />
          </div>
        )}
      </Host>
    );
  }
}
