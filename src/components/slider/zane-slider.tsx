import type { Placement } from '@popperjs/core';
import { Component, h, Element, Prop, Watch, State, Event, type EventEmitter, Method } from '@stencil/core';
import { useNamespace } from '../../hooks';
import type { ComponentSize } from '../../types';
import state from '../../global/store';
import { ReactiveObject } from '../../utils/reactive/ReactiveObject';
import type { FormContext, FormItemContext } from '../form/types';
import type { ConfigProviderContext } from '../config-provider/types';
import { inLabel } from '../../utils/component/inLabel';
import { getFormContext, getFormItemContext } from '../form/utils';
import { getConfigProviderContext } from '../config-provider/utils';
import classNames from 'classnames';
import type { SliderContext } from './types';
import { sliderContexts } from './constants';
import { debugWarn, hasRawParent, nextFrame } from '../../utils';

const ns = useNamespace('slider');

@Component({
  tag: 'zane-slider',
  styleUrl: 'zane-slider.scss'
})
export class ZaneSlider {
  @Element() el: HTMLElement;

  @Prop({ attribute: 'id' }) zId: string;

  @Prop() min: number = 0;

  @Prop() max: number = 100;

  @Prop() step: number = 1;

  @Prop({ mutable: true }) value: number | number[] = 0;

  @Prop() showInput: boolean;

  @Prop() showInputControls: boolean = true;

  @Prop() size: ComponentSize = '';

  @Prop() inputSize: ComponentSize = '';

  @Prop() showStops: boolean;

  @Prop() showTooltip: boolean = true;

  @Prop() formatTooltip: (value: number) => number | string;

  @Prop() disabled: boolean = undefined;

  @Prop() range: boolean;

  @Prop() vertical: boolean;

  @Prop() height: string;

  @Prop() rangeStartLabel: string = undefined;

  @Prop() rangeEndLabel: string = undefined;

  @Prop() formatValueText: (value: number) => string = undefined;

  @Prop() tooltipClass: string = undefined;

  @Prop() placement: Placement = 'top';

  @Prop() marks: Record<number, string | { style: Record<string, any>; label: string }>;

  @Prop() validateEvent: boolean = true;

  @Prop() label: string;

  @Prop() ariaLabel: string = undefined;

  @Event({ eventName: 'zChange', bubbles: false })
  changeEvent: EventEmitter<number | number[]>;

  @Event({ eventName: 'zInput', bubbles: false })
  inputEvent: EventEmitter<number | number[]>;

  @State() inputId: string;

  @State() sliderDisabled: boolean = false;

  @State() sliderWrapperSize: ComponentSize = '';

  @State() sliderInputSize: ComponentSize = '';

  @State() firstValue: number = 0;

  @State() secondValue: number = 0;

  @State() oldValue: number = 0;

  @State() dragging: boolean = false;

  @State() sliderSize: number = 1;

  @State() precision: number = 0;

  @State() minValue: number = 0;

  @State() maxValue: number = 0;

  @State() stops: number[] = [];

  @State() markList: {
    point: number;
    position: number;
    mark: string | { style: Record<string, any>; label: string };
  }[] = [];

  private formContext: ReactiveObject<FormContext>;

  private formItemContext: ReactiveObject<FormItemContext>;

  private configProviderContext: ReactiveObject<ConfigProviderContext>;

  private context: ReactiveObject<SliderContext>;

  private sliderWrapperRef: HTMLDivElement;

  private sliderRef: HTMLDivElement;

  private firstButtonRef: HTMLZaneSliderButtonElement;

  private secondButtonRef: HTMLZaneSliderButtonElement;

  @Watch('zId')
  handleWatchId() {
    const newId = this.zId ?? `${ns.namespace}-id-${state.idInjection.prefix}-${state.idInjection.current++}`;
    if (this.inputId !== newId) {
      if (this.formItemContext?.value.removeInputId && !inLabel(this.el)) {
        if (this.inputId) {
          this.formItemContext.value.removeInputId(this.inputId);
        }
        this.formItemContext?.value.addInputId(newId);
      }
      this.inputId = newId;
    }
  }

  @Watch("disabled")
  handleUpdateDisabled() {
    this.sliderDisabled =
      this.disabled ?? this.formContext?.value.disabled ?? false;
  }

  @Watch("size")
  handleUpdateSize() {
    this.sliderWrapperSize =
      this.size ||
      this.formItemContext?.value.size ||
      this.formContext?.value.size ||
      this.configProviderContext?.value.size ||
      "";
  }

  @Watch("sliderWrapperSize")
  handleUpdateInputSize() {
    this.sliderInputSize = this.inputSize || this.sliderWrapperSize;
  }

  @Watch('min')
  @Watch('max')
  @Watch('step')
  handleUpdatePrecision() {
    const precisions = [
      this.min,
      this.max,
      this.step,
    ].map((item) => {
      const decimal = `${item}`.split('.')[1];
      return decimal ? decimal.length : 0;
    })
    this.precision = Math.max(...precisions);
  }

  @Watch('firstValue')
  @Watch('secondValue')
  handleUpdateMinMaxValue() {
    this.minValue = Math.min(this.firstValue, this.secondValue);
    this.maxValue = Math.max(this.firstValue, this.secondValue);
  }

  @Watch('min')
  @Watch('max')
  @Watch('step')
  @Watch('showStops')
  @Watch('range')
  @Watch('maxValue')
  @Watch('minValue')
  handleUpdateStops() {
    if (!this.showStops || this.min > this.max) {
      this.stops = [];
      return;
    }
    if (this.step === 0) {
      this.stops = [];
      debugWarn('ZaneSlider', 'Step cannot be 0 when showStops is true.');
      return;
    }

    const stopCount = Math.ceil((this.max - this.min) / this.step);
    const stepWidth = (100 * this.step) / (this.max - this.min);
    const result = Array.from<number>({ length: stopCount - 1 }).map(
      (_, index) => (index + 1) * stepWidth
    );

    if (this.range) {
      this.stops = result.filter((step) => {
        return step < (100 * (this.minValue - this.min)) / (this.max - this.min) ||
          step > (100 * (this.maxValue - this.min)) / (this.max - this.min);
      });
    } else {
      this.stops = result.filter((step) => {
        return step > (100 * (this.firstValue - this.min)) / (this.max - this.min);
      });
    }
  }

  @Watch('marks')
  @Watch('min')
  @Watch('max')
  handleUpdateMarkList() {
    if (!this.marks) {
      this.markList = [];
      return;
    }

    const marksKeys = Object.keys(this.marks);
    this.markList = marksKeys
      .map(Number.parseFloat)
      .sort((a, b) => a - b)
      .filter((point) => point <= this.max && point >= this.min)
      .map((point) => {
        return {
          point,
          position: (100 * (point - this.min)) / (this.max - this.min),
          mark: this.marks[point],
        }
      });
  }

  @Watch('sliderSize')
  handleSliderSizeChange() {
    this.context.value.sliderSize = this.sliderSize;
  }

  @Method()
  async getContext() {
    return this.context;
  }

  private isLabeledByFormItem = () => {
    return !!(
      !(this.label || this.ariaLabel) &&
      this.formItemContext &&
      this.formItemContext?.value.inputIds &&
      this.formItemContext?.value.inputIds.length <= 1
    );
  };

  private emitChange = () => {
    nextFrame(() => {
      this.changeEvent.emit(
        this.range ? [this.minValue, this.maxValue] : this.value
      );
    });
  }

  private resetSize = () => {
    if (this.sliderRef) {
      const rect = this.sliderRef.getBoundingClientRect();
      this.sliderSize = this.vertical ? rect.height : rect.width;
    }
  }

  private updateDragging = (dragging: boolean) => {
    this.dragging = dragging;
  }

  private onSliderWrapperPrevent = async (e: TouchEvent) => {
    const firstButtonDragging = await this.firstButtonRef?.isDragging();
    const secondButtonDragging = await this.secondButtonRef?.isDragging();
    if (firstButtonDragging || secondButtonDragging) {
      e.preventDefault();
    }
  }

  private getButtonRefByPercent = (percent: number): HTMLZaneSliderButtonElement => {
    const targetValue = this.min + (percent * (this.max - this.min)) / 100;
    if (!this.range) {
      return this.firstButtonRef;
    }
    let buttonRefName: 'firstButtonRef' | 'secondButtonRef';
    if (Math.abs(this.minValue - targetValue) < Math.abs(this.maxValue - targetValue)) {
      buttonRefName = this.firstValue < this.secondValue ? 'firstButtonRef' : 'secondButtonRef';
    } else {
      buttonRefName = this.firstValue > this.secondValue ? 'firstButtonRef' : 'secondButtonRef';
    }

    const buttonRefs = {
      firstButtonRef: this.firstButtonRef,
      secondButtonRef: this.secondButtonRef,
    };
    return buttonRefs[buttonRefName];
  }

  private setPosition = (percent: number) => {
    const buttonRef = this.getButtonRefByPercent(percent);
    buttonRef?.setPosition(percent);
    return buttonRef;
  }

  private handleSliderPointerEvent = (event: MouseEvent | TouchEvent) => {
    if (this.sliderDisabled || this.dragging) {
      return;
    }

    this.resetSize();
    let newPercent = 0;
    if (this.vertical) {
      const clientY = (event as TouchEvent).touches?.item(0)?.clientY ?? (event as MouseEvent).clientY;
      const sliderOffsetBottom = this.sliderRef.getBoundingClientRect().bottom;
      newPercent = ((sliderOffsetBottom - clientY) / this.sliderSize) * 100;
    } else {
      const clientX = (event as TouchEvent).touches?.item(0)?.clientX ?? (event as MouseEvent).clientX;
      const sliderOffsetLeft = this.sliderRef.getBoundingClientRect().left;
      newPercent = ((clientX - sliderOffsetLeft) / this.sliderSize) * 100;
    }
    if (newPercent < 0 || newPercent > 100) {
      return;
    }
    return this.setPosition(newPercent);
  }

  private handleFirstValueChange = (event: CustomEvent<number>) => {
    this.firstValue = event.detail;
    this.value = this.range ? [this.minValue, this.maxValue] : (this.firstValue ?? this.min)
    this.inputEvent.emit(this.value);
  }

  private handleSecondValueChange = (event: CustomEvent<number>) => {
    this.secondValue = event.detail;
    this.value = [this.minValue, this.maxValue];
    this.inputEvent.emit(this.value);
  }

  private onSliderDown = (event: MouseEvent | TouchEvent) => {
    const buttonRef = this.handleSliderPointerEvent(event);
    if (buttonRef) {
      nextFrame(() => {
        buttonRef.onButtonDown(event as MouseEvent);
      });
    }
  }

  private onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    this.onSliderDown(event);
  }

  private getStopStyle = (position: number) => {
    return this.vertical ? { bottom: `${position}%` } : { left: `${position}%` };
  }

  private onSliderMarkerDown = (position: number) => {
    if (this.sliderDisabled || this.dragging) {
      return;
    }
    const buttonRef = this.setPosition(position);
    if (buttonRef) {
      this.emitChange();
    }
  }

  componentWillLoad() {
    this.formContext = getFormContext(this.el);
    this.formItemContext = getFormItemContext(this.el);
    this.configProviderContext = getConfigProviderContext(this.el);

    if (!this.range && typeof this.value === 'number') {
      this.firstValue = this.value;
    }
    this.handleWatchId();
    this.handleUpdateDisabled();
    this.handleUpdateSize();
    this.handleUpdatePrecision();
    this.handleUpdateStops();
    this.handleUpdateMarkList();

    this.context = new ReactiveObject<SliderContext>({
      min: this.min,
      max: this.max,
      step: this.step,
      showTooltip: this.showTooltip,
      precision: this.precision,
      sliderSize: this.sliderSize,
      disabled: this.sliderDisabled,
      formatTooltip: this.formatTooltip,
      emitChange: this.emitChange,
      resetSize: this.resetSize,
      updateDragging: this.updateDragging,
    });
    sliderContexts.set(this.el, this.context);

    this.sliderWrapperRef?.addEventListener('touchstart', this.onSliderWrapperPrevent, { passive: false });
    this.sliderWrapperRef?.addEventListener('touchmove', this.onSliderWrapperPrevent, { passive: false });
  }

  disconnectedCallback() {
    if (!hasRawParent(this.el)) {
      sliderContexts.delete(this.el);
      this.context = null;
    }
    this.sliderWrapperRef?.removeEventListener('touchstart', this.onSliderWrapperPrevent);
    this.sliderWrapperRef?.removeEventListener('touchmove', this.onSliderWrapperPrevent);
  }

  render() {
    const sliderKls = classNames(
      ns.b(),
      ns.m(this.sliderWrapperSize),
      ns.is('vertical', this.vertical),
      {
        [ns.m('with-input')]: this.showInput,
      }
    );

    const runwayStyle = this.vertical ? { height: this.height } : {};

    const barSize = this.range
      ? `${(100 * (this.maxValue - this.minValue)) / (this.max - this.min)}%`
      : `${(100 * (this.firstValue - this.min)) / (this.max - this.min)}%`;

    const barStart = this.range
      ? `${(100 * (this.minValue - this.min)) / (this.max - this.min)}%`
      : '0%';

    const barStyle = this.vertical
      ? {
        height: barSize,
        bottom: barStart
      }
      : {
        width: barSize,
        left: barStart
      }

    const { t } = state.i18n;

    const _isLabeledByFormItem = this.isLabeledByFormItem();

    const groupLabel = this.ariaLabel || t('slider.defaultLabel', {params: {min: this.min, max: this.max}});

    const firstButtonLabel = this.range
      ? (this.rangeStartLabel || t('slider.defaultRangeStartLabel'))
      : groupLabel;

    const firstValueText = this.formatValueText ? this.formatValueText(this.firstValue) : `${this.firstValue}`;

    const secondButtonLabel = this.rangeEndLabel || t('slider.defaultRangeEndLabel');

    const secondValueText = this.formatValueText ? this.formatValueText(this.secondValue) : `${this.secondValue}`;

    return (
      <div
        id={this.range ? this.inputId : undefined}
        ref={(el) => this.sliderWrapperRef = el}
        class={sliderKls}
        role={this.range ? 'group' : undefined}
        ariaLabel={this.range && !_isLabeledByFormItem ? groupLabel : undefined}
        ariaLabelledby={this.range && _isLabeledByFormItem ? this.formItemContext?.value.labelId : undefined}
      >
        <div
          ref={(el) => this.sliderRef = el}
          class={classNames(
            ns.e('runway'),
            {
              'show-input': this.showInput && !this.range
            },
            ns.is('disabled', this.sliderDisabled)
          )}
          style={runwayStyle}
          onMouseDown={this.onSliderDown}
          onTouchStart={this.onTouchStart}
        >
          <div class={ns.e('bar')} style={barStyle}></div>
          <zane-slider-button
            ref={(el) => this.firstButtonRef = el}
            id={!this.range ? this.inputId : undefined}
            value={this.firstValue}
            vertical={this.vertical}
            placement={this.placement}
            role='slider'
            ariaLabel={ this.range || !_isLabeledByFormItem ? firstButtonLabel : undefined }
            ariaLabelledby={ this.range && _isLabeledByFormItem ? this.formItemContext?.value.labelId : undefined }
            ariaValuemin={`${this.min}`}
            ariaValuemax={`${this.range ? this.secondValue : this.max}`}
            ariaValuenow={`${this.firstValue}`}
            ariaValuetext={firstValueText}
            ariaOrientation={this.vertical ? 'vertical' : 'horizontal'}
            ariaDisabled={this.sliderDisabled ? 'true' : 'false'}
            onZChange={this.handleFirstValueChange}
          ></zane-slider-button>
          {
            this.range && <zane-slider-button
              ref={(el) => this.secondButtonRef = el}
              value={this.secondValue}
              vertical={this.vertical}
              placement={this.placement}
              role='slider'
              ariaLabel={secondButtonLabel}
              ariaValuemin={`${this.firstValue}`}
              ariaValuemax={`${this.max}`}
              ariaValuenow={`${this.secondValue}`}
              ariaValuetext={secondValueText}
              ariaOrientation={this.vertical ? 'vertical' : 'horizontal'}
              ariaDisabled={this.sliderDisabled ? 'true' : 'false'}
              onZChange={this.handleSecondValueChange}
            ></zane-slider-button>
          }
          {
            this.showStops && (<div>
              {
                this.stops.map((item, index) => (
                  <div
                    key={index}
                    class={ns.e('stop')}
                    style={this.getStopStyle(item)}
                  ></div>
                ))
              }
            </div>)
          }
          {
            this.markList.length > 0 && (<div>
              {
                this.markList.map((item, index) => (
                  <div
                    key={index}
                    style={this.getStopStyle(item.position)}
                    class={classNames(
                      ns.e('stop'),
                      ns.e('marks-stop')
                    )}
                  ></div>
                ))
              }
            </div>)
          }
          {
            this.markList.length > 0 && (<div class={ns.e('marks')}>
              {
                this.markList.map((item, index) => (
                  <zane-slider-marker
                    key={index}
                    style={this.getStopStyle(item.position)}
                    mark={item.mark}
                    onMouseDown={(event: MouseEvent) => {
                      event.stopPropagation();
                      this.onSliderMarkerDown(item.position);
                    }}
                  ></zane-slider-marker>
                ))
              }
            </div>)
          }
        </div>
      </div>
    );
  }
}
