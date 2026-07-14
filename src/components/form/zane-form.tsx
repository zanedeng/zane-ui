import type { ComponentSize } from "../../types";
import type {
  FormContext,
  FormItemContext,
  FormItemProp,
  FormRules,
  FormValidateCallback,
} from "./types";
import type { Arrayable } from "../../types";

import {
  Component,
  Element,
  Event,
  h,
  Method,
  Prop,
  State,
  Watch,
  type EventEmitter,
} from "@stencil/core";

import { useNamespace } from "../../hooks";
import { formContexts } from "./constants";
import { debugWarn, hasRawParent, isFunction, ReactiveObject } from "../../utils";
import { filterFields } from "./utils";
import type { ValidateFieldsError } from "async-validator";

const ns = useNamespace("form");

const COMPONENT_NAME = "zane-form";

@Component({
  styleUrl: "zane-form.scss",
  tag: "zane-form",
})
export class ZaneForm {
  @Prop() disabled: boolean | undefined;

  @Element() el: HTMLElement | undefined;

  @Prop() hideRequiredAsterisk: boolean = false;

  @Prop() inline: boolean = false;

  @Prop() inlineMessage: boolean = false;

  @Prop() labelPosition: "left" | "right" | "top" = "right";

  @Prop() labelSuffix: string = "";

  @Prop() labelWidth: number | string = "";

  @Prop() model: Record<string, any> | undefined;

  @Prop() requireAsteriskPosition: "left" | "right" = "left";

  @Prop() rules: FormRules | undefined;

  @Prop() scrollIntoViewOptions: boolean | ScrollIntoViewOptions = true;

  @Prop() scrollToError: boolean = false;

  @Prop() showMessage: boolean = true;

  @Prop() size: ComponentSize = '';

  @Prop() statusIcon: boolean = false;

  @Prop() validateOnRuleChange: boolean = true;

  @State() fields: ReactiveObject<FormItemContext>[] = [];

  @State() potentialLabelWidthArr: number[] = [];

  @Event({ eventName: "validate", bubbles: false })
  validateEvent: EventEmitter<{
    prop: FormItemProp;
    isValid: boolean;
    message: string;
  }> | undefined;

  private formRef: HTMLFormElement | undefined;

  private context: ReactiveObject<FormContext> | undefined;

  private getLabelWidthIndex = (width: number) => {
    const index = this.potentialLabelWidthArr.indexOf(width);
    if (index === -1 && !this.potentialLabelWidthArr.length) {
      debugWarn(COMPONENT_NAME, `unexpected width ${width}`);
    }
    return index;
  };

  private registerLabelWidth = (val: number, oldVal: number) => {
    const arr = [...this.potentialLabelWidthArr];
    if (val && oldVal) {
      const index = this.getLabelWidthIndex(oldVal);
      arr.splice(index, 1, val);
    } else if (val) {
      arr.push(val);
    }
    this.potentialLabelWidthArr = arr;
  };

  private deregisterLabelWidth = (val: number) => {
    const index = this.getLabelWidthIndex(val);
    if (index > -1) {
      const arr = [...this.potentialLabelWidthArr];
      arr.splice(index, 1);
      this.potentialLabelWidthArr = arr;
    }
  };

  private resetFields = (props: Arrayable<FormItemProp> = []) => {
    if (!this.model) {
      debugWarn(COMPONENT_NAME, "model is required for resetFields to work.");
      return;
    }
    filterFields(this.fields, props).forEach((field) =>
      field.value.resetField()
    );
  };

  private clearValidate = (props: Arrayable<FormItemProp> = []) => {
    filterFields(this.fields, props).forEach((field) => field.value.clearValidate());
  };

  private getField = (prop: FormItemProp) => {
    return filterFields(this.fields, [prop])[0];
  };

  private addField = (field: ReactiveObject<FormItemContext>) => {
    this.fields.push(field);
  };

  private removeField = (field: ReactiveObject<FormItemContext>) => {
    if (field.value.prop) {
      this.fields.splice(this.fields.indexOf(field), 1);
    }
  };

  componentWillLoad() {
    this.context = new ReactiveObject<FormContext>({
      disabled: this.disabled,
      model: this.model,
      size: this.size,
      rules: this.rules,
      labelPosition: this.labelPosition,
      requireAsteriskPosition: this.requireAsteriskPosition,
      labelWidth: this.labelWidth,
      labelSuffix: this.labelSuffix,
      inline: this.inline,
      inlineMessage: this.inlineMessage,
      statusIcon: this.statusIcon,
      showMessage: this.showMessage,
      validateOnRuleChange: this.validateOnRuleChange,
      hideRequiredAsterisk: this.hideRequiredAsterisk,
      scrollToError: this.scrollToError,
      scrollIntoViewOptions: this.scrollIntoViewOptions,
      validateEvent: this.validateEvent,
      autoLabelWidth: '0',
      registerLabelWidth: this.registerLabelWidth,
      deregisterLabelWidth: this.deregisterLabelWidth,
      resetFields: this.resetFields,
      clearValidate: this.clearValidate,
      validateField: this.validateField,
      getField: this.getField,
      addField: this.addField,
      removeField: this.removeField,
    });

    formContexts.set(this.el!, this.context);
  }

  disconnectedCallback() {
    if (!hasRawParent(this.el!)) {
      formContexts.delete(this.el!);
      this.context = undefined;
    }
  }

  @Watch("rules")
  onRulesChange() {
    if (this.validateOnRuleChange) {
      this.validate();
    }
  }

  @Watch('potentialLabelWidthArr')
  onPotentialLabelWidthArrChange() {
    this.context!.value.autoLabelWidth = this.potentialLabelWidthArr.length
      ? Math.max(...this.potentialLabelWidthArr) + 'px'
      : '0';
  }

  @Method()
  async getContext() {
    return this.context;
  }

  @Method()
  async validate(callback?: FormValidateCallback) {
    return this.validateField(undefined, callback);
  }

  @Method()
  async validateField(
    modelProps?: Arrayable<FormItemProp> | undefined,
    callback?: FormValidateCallback
  ) {
    let result = false;
    const shouldThrow = !isFunction(callback);
    try {
      result = await this.doValidateField(modelProps);
      if (result === true) {
        await callback?.(result);
      }
      return result;
    } catch (error) {
      if (error instanceof Error) throw error;

      const invalidFields = error as ValidateFieldsError;
      if (this.scrollToError) {
        if (this.formRef) {
          const formItem = this.formRef.querySelector(
            `.${ns.b()}-item.is-error`
          );
          formItem?.scrollIntoView(this.scrollIntoViewOptions);
        }
      }
      !result && (await callback?.(false, invalidFields));
      return shouldThrow && Promise.reject(invalidFields);
    }
  }

  private isValidatable = () => {
    const hasModel = !!this.model;
    if (!hasModel) {
      debugWarn(COMPONENT_NAME, "model is required for validate to work.");
    }
    return hasModel;
  };

  private obtainValidateFields = (props: Arrayable<FormItemProp>) => {
    if (this.fields.length === 0) return [];

    const filteredFields = filterFields(this.fields, props);
    if (!filteredFields.length) {
      debugWarn(COMPONENT_NAME, "please pass correct props!");
      return [];
    }
    return filteredFields;
  };

  private doValidateField = async (
    props: Arrayable<FormItemProp> = []
  ): Promise<boolean> => {
    if (!this.isValidatable()) {
      return false;
    }

    const fields = this.obtainValidateFields(props);
    if (fields.length === 0) {
      return true;
    }

    let validationErrors: ValidateFieldsError = {};
    for (const field of fields) {
      try {
        await field.value.validate("");
        if (field.value.validateState === "error" && !field.value.error) {
          field.value.resetField();
        }
      } catch (fields) {
        validationErrors = {
          ...validationErrors,
          ...(fields as ValidateFieldsError),
        };
      }
    }
    if (Object.keys(validationErrors).length === 0) return true;
    return Promise.reject(validationErrors);
  };

  render() {
    const formClasses = {
      [ns.b()]: true,
      [ns.m("inline")]: this.inline,
      [ns.m(`label-${this.labelPosition}`)]: !!this.labelPosition,
      [ns.m(this.size || "default")]: true,
    };

    return (
      <form ref={(el) => (this.formRef = el)} class={formClasses}>
        <slot />
      </form>
    );
  }
}
