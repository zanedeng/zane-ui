import { Component, Element, Event, h, Host, Method, Prop, State, Watch, type EventEmitter } from '@stencil/core';
import type { ReactiveObject } from '../../utils/reactive/ReactiveObject';
import type { FormContext, FormItemContext } from '../form/types';
import type { ConfigProviderContext } from '../config-provider/types';
import { getFormContext, getFormItemContext } from '../form/utils';
import { getConfigProviderContext } from '../config-provider/utils';
import { useNamespace } from '../../hooks';
import type { ComponentSize } from '../../types';
import state from '../../global/store';
import { addUnit, debugWarn, getEventCode, inLabel, isBoolean, isPromise, nextFrame, throwError } from '../../utils';
import classNames from 'classnames';
import { EVENT_CODE } from '../../constants';

const ns = useNamespace('switch');

@Component({
  tag: 'zane-switch',
  styleUrl: 'zane-switch.scss'
})
export class ZaneSwitch {
  @Element() el!: HTMLElement;

  @Prop({ attribute: 'id' }) zId?: string;

  @Prop({ mutable: true }) value: boolean | string | number = false;

  @Prop() disabled?: boolean = undefined;

  @Prop() loading: boolean = false;

  @Prop() inlinePrompt: boolean = false;

  @Prop() size: ComponentSize = '';

  @Prop() activeText: string = '';

  @Prop() activeValue: boolean | string | number = true;

  @Prop() activeIcon?: string;

  @Prop() activeActionIcon?: string;

  @Prop() inactiveText: string = '';

  @Prop() inactiveIcon?: string;

  @Prop() inactiveActionIcon?: string;

  @Prop() inactiveValue: boolean | string | number = false;

  @Prop() name: string = '';

  @Prop() validateEvent: boolean = true;

  @Prop() width: string | number = '';

  @Prop() beforeChange?: () => Promise<boolean> | boolean;

  @Prop({ attribute: 'tabindex' }) zTabindex: number = -1;

  @Prop() ariaLabel?: string;

  @Event({ eventName: 'zChange', bubbles: false })
  changeEvent?: EventEmitter<boolean | string | number>;

  @Event({ eventName: 'zInput', bubbles: false })
  inputEvent?: EventEmitter<boolean | string | number>;

  @State() inputId?: string;

  @State() switchDisabled: boolean = false;

  @State() switchSize: ComponentSize = '';

  @State() isControlled: boolean = false;

  @State() actualValue?: boolean | string | number;

  @State() checked: boolean = false;

  private formContext?: ReactiveObject<FormContext>;

  private formItemContext?: ReactiveObject<FormItemContext>;

  private configProviderContext?: ReactiveObject<ConfigProviderContext>;

  private inputRef?: HTMLInputElement;

  private hasInactiveSlot: boolean = false;

  private hasActiveSlot: boolean = false;

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
    this.switchDisabled =
      this.disabled ?? this.formContext?.value.disabled ?? (this.loading ? true : false);
  }

  @Watch("size")
  handleUpdateSize() {
    this.switchSize =
      this.size ||
      this.formItemContext?.value.size ||
      this.formContext?.value.size ||
      this.configProviderContext?.value.size ||
      "";
  }

  @Watch("value")
  handleUpdateValue() {
    this.isControlled = true;
  }

  @Watch('value')
  @Watch('isControlled')
  handleUpdateActualValue() {
    this.actualValue = this.isControlled ? this.value : false;
  }

  @Watch('actualValue')
  handleUpdateChecked() {
    this.checked = this.actualValue === this.activeValue;
  }

  @Watch('checked')
  handleCheckedChange() {
    this.inputRef!.checked = this.checked;
    if (this.validateEvent) {
      this.formItemContext?.value.validate?.('change').catch((err) => debugWarn(err))
    }
  }

  componentWillLoad() {
    this.formContext = getFormContext(this.el);
    this.formItemContext = getFormItemContext(this.el);
    this.configProviderContext = getConfigProviderContext(this.el);

    this.hasActiveSlot = !!this.el.querySelector('[slot="active"]');
    this.hasInactiveSlot = !!this.el.querySelector('[slot="inactive"]');

    this.handleWatchId();
    this.handleUpdateDisabled();
    this.handleUpdateSize();

    this.isControlled = this.value !== false;

    if (![this.activeValue, this.inactiveValue].includes(this.actualValue!)) {
      this.value = this.inactiveValue;
      this.changeEvent?.emit(this.inactiveValue);
      this.inputEvent?.emit(this.inactiveValue);
    }
  }

  componentDidLoad() {
    this.inputRef!.checked = this.checked;
  }

  private handleChange = () => {
    const val = this.checked ? this.inactiveValue : this.activeValue;
    this.value = val;
    this.changeEvent?.emit(val);
    this.inputEvent?.emit(val);
    nextFrame(() => {
      this.inputRef!.checked = this.checked;
    });
  }

  private switchValue = () => {
    if (this.switchDisabled) {
      return;
    }

    if (!this.beforeChange) {
      this.handleChange();
      return;
    }

    const shouldChange = this.beforeChange();
    const isPromiseOrBool = [
      isPromise(shouldChange),
      isBoolean(shouldChange),
    ].includes(true);

    if (!isPromiseOrBool) {
      throwError(
        'zane-switch',
        'beforeChange must return type `Promise<boolean>` or `boolean`'
      );
    }

    if (isPromise(shouldChange)) {
      shouldChange.then((result) => {
        if (result) {
          this.handleChange();
        }
      }).catch((e) => {
        debugWarn('zane-switch', `some error occurred: ${e}`);
      });
    } else if (shouldChange) {
      this.handleChange();
    }
  }

  private handleClick = (e: MouseEvent) => {
    e.preventDefault();
    this.switchValue();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = getEventCode(e);
    if (code === EVENT_CODE.enter || code === EVENT_CODE.numpadEnter) {
      this.switchValue();
    }
  }

  @Method()
  async zFocus() {
    this.inputRef?.focus();
  }

  @Method()
  async isChecked() {
    return this.checked;
  }

  render() {
    return (
      <Host
        class={classNames(
          ns.b(),
          ns.m(this.switchSize),
          ns.is('disabled', this.switchDisabled),
          ns.is('checked', this.checked)
        )}
        onClick={this.handleClick}
      >
        <input
          id={this.inputId}
          ref={(el) => (this.inputRef = el)}
          class={ns.e('input')}
          type='checkbox'
          role='switch'
          aria-checked={this.checked}
          aria-disabled={this.switchDisabled}
          aria-label={this.ariaLabel}
          name={this.name}
          true-value={this.activeValue}
          false-value={this.inactiveValue}
          disabled={this.switchDisabled}
          tabIndex={this.zTabindex}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
        />
        {
          (!this.inlinePrompt && (this.inactiveIcon || this.inactiveText || this.hasInactiveSlot)) && (
            <span
              class={classNames(
                ns.e('label'),
                ns.em('label', 'left'),
                ns.is('active', !this.checked)
              )}
            >
              <slot name="inactive">
                {
                  this.inactiveIcon
                    ? (<zane-icon name={this.inactiveIcon}></zane-icon>)
                    : this.inactiveText
                      ? (<span aria-hidden={this.checked}>{this.inactiveText}</span>)
                      : null
                }
              </slot>
            </span>
          )
        }
        <span class={ns.e('core')} style={{width: addUnit(this.width)}}>
          {
            this.inlinePrompt && (
              <div
                class={ns.e('inner')}
              >
                {
                  this.checked
                    ? (
                      <div
                        class={ns.e('inner-wrapper')}
                      >
                        <slot name='active'>
                          {
                            this.activeIcon
                              ? (<zane-icon name={this.activeIcon}></zane-icon>)
                              : this.activeText
                                ? (<span>{this.activeText}</span>)
                                : null
                          }
                        </slot>
                      </div>
                    )
                    : (
                      <div
                        class={ns.e('inner-wrapper')}
                      >
                        <slot name="inactive">
                          {
                            this.inactiveIcon
                              ? (<zane-icon name={this.inactiveIcon}></zane-icon>)
                              : this.inactiveText
                                ? (<span>{this.inactiveText}</span>)
                                : null
                          }
                        </slot>
                      </div>
                    )
                }
              </div>
            )
          }
          <div class={ns.e('action')}>
            {
              this.loading ? (
                <zane-icon class={ns.is('loading')} name="loading"></zane-icon>
              ) : this.checked ? (
                <slot name="active-action">
                  { this.activeActionIcon && (<zane-icon name={this.activeActionIcon}></zane-icon>) }
                </slot>
              ) : (
                <slot name="inactive-action">
                  { this.inactiveActionIcon && (<zane-icon name={this.inactiveActionIcon}></zane-icon>)}
                </slot>
              )
            }
          </div>
        </span>
        {
          (!this.inlinePrompt && (this.activeIcon || this.activeText || this.hasActiveSlot)) && (
            <span
              class={classNames(
                ns.e('label'),
                ns.em('label', 'right'),
                ns.is('active', this.checked)
              )}
            >
              <slot name="active">
                {
                  this.activeIcon
                    ? (<zane-icon name={this.activeIcon}></zane-icon>)
                    : this.activeText
                      ? (<span aria-hidden={!this.checked}>{this.activeText}</span>)
                      : null
                }
              </slot>
            </span>
          )
        }
      </Host>
    );
  }
}
