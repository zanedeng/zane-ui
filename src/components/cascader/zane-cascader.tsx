import type { EventEmitter } from "@stencil/core";

import type { ComponentSize } from "../../types";
import type { CascaderNode } from "./node";
import type {
  CascaderNodePathValue,
  CascaderNodeValue,
  CascaderOption,
  CascaderProps,
  CascaderValue,
  RenderLabel,
  Tag,
} from "./types";

import {
  Component,
  Element,
  Event,
  h,
  Host,
  Prop,
  State,
  Watch,
} from "@stencil/core";

import state from "../../global/store";
import { useNamespace } from "../../hooks";
import {
  debugWarn,
  focusNode,
  getEventCode,
  getSibling,
  isClient,
  isFunction,
  isKorean,
  isPromise,
  nextFrame,
  type ReactiveObject,
} from "../../utils";
import type { FormContext, FormItemContext } from "../form/types";
import { getFormContext, getFormItemContext } from "../form/utils";
import type { ConfigProviderContext } from "../config-provider/types";
import { getConfigProviderContext } from "../config-provider/utils";
import { DEFAULT_VALUE_ON_CLEAR, EVENT_CODE } from "../../constants";
import { cloneDeep, debounce } from "lodash-es";
import classNames from "classnames";
import type { Props } from "tippy.js";

const ns = useNamespace("cascader");

const nsInput = useNamespace("input");

// const SCOPE = 'zane-cascader';

@Component({
  styleUrl: "zane-cascader.scss",
  tag: "zane-cascader",
})
export class ZaneCascader {
  @Prop() checkOnClickNode: boolean = false;

  @Prop() clearable: boolean = false;

  @Prop() clearIcon: string = "close-circle-line";

  @Prop() collapseTags: boolean = false;

  @Prop() collapseTagsTooltip: boolean = false;

  @Prop() debounce: number = 300;

  @Prop() disabled?: boolean = undefined;

  @Element() el!: HTMLElement;

  @Prop() filterable: boolean = false;

  @State() filtering: boolean = false;

  @Prop({ mutable: true }) filterMethod?: (
    node: CascaderNode,
    keyword: string
  ) => boolean;

  @Event({ eventName: "zFocus", bubbles: false })
  focusEvent?: EventEmitter<FocusEvent>;

  @Event({ eventName: "zRemoveTag", bubbles: false })
  removeTagEvent?: EventEmitter<
    CascaderNodeValue | CascaderNodePathValue
  >;

  @State() inputHover: boolean = false;

  @State() inputValue: string = "";

  @State() isFocused: boolean = false;

  @Prop() maxCollapseTags: number = 1;

  @Prop() maxCollapseTagsTooltipHeight?: number | string;

  @Prop({ mutable: true }) value?: CascaderValue;

  @Prop() options: CascaderOption[] = [];

  @Prop() props: CascaderProps = {};

  @Prop() placeholder: string = "Select";

  @Prop() placement:
    | "bottom"
    | "bottom-start"
    | "left"
    | "right"
    | "top"
    | "top-start" = "bottom-start";

  @Prop() popperTheme: string = "cascader";

  @Prop() popperOptions: Props['popperOptions'] = {};

  @Prop() popperBoxClass: string = '';

  @Prop() popperContentClass: string = '';

  @State() popperVisible?: boolean = undefined;

  @State() searchKeyword: string = "";

  @State() searchInputValue: string = "";

  @Prop() separator: string = " / ";

  @Prop() showAllLevels: boolean = true;

  @Prop() showCheckedStrategy: "child" | "parent" = "child";

  @Prop() showPrefix: boolean = true;

  @Prop() size?: ComponentSize;

  @Prop() tagType: "primary" | "success" | "info" | "warning" | "danger" =
    "info";

  @Prop() tagEffect: "light" | "dark" | "plain" = "light";

  @State() tags: Tag[] = [];

  @Prop() validateEvent: boolean = true;

  @Prop() valueOnClear?: string | number | boolean | Function | null = undefined;

  @Event({ eventName: "zBlur", bubbles: false })
  blurEvent?: EventEmitter<FocusEvent>;

  @Event({ eventName: "zClear", bubbles: false })
  clearEvent?: EventEmitter<void>;

  @Event({ eventName: "zChange", bubbles: false })
  changeEvent?: EventEmitter<CascaderValue>;

  @Event({ eventName: "zCompositionEnd", bubbles: false })
  compositionendEvent?: EventEmitter<CompositionEvent>;

  @Event({ eventName: "zCompositionStart", bubbles: false })
  compositionstartEvent?: EventEmitter<CompositionEvent>;

  @Event({ eventName: "zCompositionUpdate", bubbles: false })
  compositionupdateEvent?: EventEmitter<CompositionEvent>;

  @Event({ eventName: "zVisibleChange", bubbles: false })
  visibleChangeEvent?: EventEmitter<boolean>;

  @Event({ eventName: "zExpandChange", bubbles: false })
  expandChangeEvent?: EventEmitter<CascaderNodePathValue>;

  @Prop() wrapperStyle?: Record<string, string>;

  @Prop() renderLabel?: RenderLabel;

  @Prop() renderTags?: (
    tags: Tag[],
    deleteTag: (tag: Tag) => void
  ) => HTMLElement;

  @Prop() renderSuggestion?: (suggestions: CascaderNode[]) => HTMLElement;

  @Prop() beforeFilter: (value: string) => boolean | Promise<any> = () => true;

  @State() realSize?: ComponentSize;

  @State() tagSize?: ComponentSize;

  @State() collapseTagList: Tag[] = [];

  @State() showTagList: Tag[] = [];

  @State() isDisabled: boolean = false;

  @State() isComposing: boolean = false;

  @State() suggestions: CascaderNode[] = [];

  @State() presentText: string = "";

  @State() checkedNodes?: CascaderNode[] = undefined;

  private formContext?: ReactiveObject<FormContext>;

  private formItemContext?: ReactiveObject<FormItemContext>;

  private configProviderContext?: ReactiveObject<ConfigProviderContext>;

  private cascaderPanelRef?: HTMLZaneCascaderPanelElement;

  private inputInitialHeight = 0;

  private inputRef?: HTMLZaneInputElement;

  private suggestionPanel?: HTMLZaneScrollbarElement;

  private tagTooltipRef?: HTMLZaneTippyElement;

  private tagWrapper?: HTMLElement;

  private tooltipRef?: HTMLZaneTippyElement;

  private wrapperRef?: HTMLElement;

  private hasPrefixSlot: boolean = false;

  private hasHeaderSlot: boolean = false;

  private hasFooterSlot: boolean = false;

  componentWillLoad() {
    this.hasPrefixSlot = !!this.el.querySelector('[slot="prefix"]');
    this.hasHeaderSlot = !!this.el.querySelector('[slot="header"]');
    this.hasFooterSlot = !!this.el.querySelector('[slot="footer"]');
    this.formContext = getFormContext(this.el);
    this.formItemContext = getFormItemContext(this.el);
    this.configProviderContext = getConfigProviderContext(this.el);

    if (!this.filterMethod) {
      this.filterMethod = (node: CascaderNode, keyword: string) =>
        node.text.includes(keyword);
    }

    this.updateRealSize();
    this.updateCollapseTagList();
    this.updateIsDisabled();
    this.syncPresentTextValue();

    this.formContext?.change$.subscribe(({ key }) => {
      if (key === "size") {
        this.updateRealSize();
      }
      if (key === "disabled") {
        this.updateIsDisabled();
      }
    });

    this.formItemContext?.change$.subscribe(({ key }) => {
      if (key === "size") {
        this.updateRealSize();
      }
    });

    this.configProviderContext?.change$.subscribe(({ key }) => {
      if (key === "size") {
        this.updateRealSize();
      }
    });
  }

  componentDidLoad() {
    const inputInnerHeight = this.getInputInnerHeight(this.inputRef!);
    this.inputInitialHeight = this.inputRef!.offsetHeight || inputInnerHeight;

  }

  private updateRealSize = () => {
    this.realSize =
      this.size ||
      this.formItemContext?.value.size ||
      this.formContext?.value.size ||
      this.configProviderContext?.value.size ||
      "";
  };

  private updateCollapseTagList = () => {
    if (!this.props.multiple) {
      this.collapseTagList = [];
    }
    this.collapseTagList = this.collapseTags ? this.tags.slice(this.maxCollapseTags) : [];
  };

  private updateIsDisabled = () => {
    this.isDisabled =
      this.disabled || this.formContext?.value.disabled || false;
  };

  @Watch("tags")
  handleWatchTags() {
    nextFrame(() => {
      this.updateStyle();
    });
  }

  @Watch("size")
  handleWatchSize() {
    this.updateRealSize();
  }

  @Watch("realSize")
  handleWatchRealSize() {
    this.tagSize = this.realSize === "small" ? "small" : "default";
    nextFrame(() => {
      this.inputInitialHeight = this.getInputInnerHeight(this.inputRef!) || this.inputInitialHeight;
    });
  }

  @Watch("props")
  @Watch("collapseTags")
  @Watch("maxCollapseTags")
  @Watch("tags")
  handleupdateCollapseTagList() {
    this.updateCollapseTagList();
  }

  @Watch("disabled")
  handleWatchDisabled() {
    this.updateIsDisabled();
  }

  @Watch('filtering')
  handleWatchFiltering() {
    this.updatePopperPosition();
  }

  @Watch('checkedNodes')
  @Watch('isDisabled')
  @Watch('collapseTags')
  @Watch('maxCollapseTags')
  handleCalculatePresentTags() {
    this.calculatePresentTags();
  }

  @Watch('popperVisible')
  handleWatchPopperVisible() {
    this.popperVisible ? this.tooltipRef?.show() : this.tooltipRef?.hide();
    if (this.popperVisible && this.props.lazy && this.props.lazyLoad) {
      this.cascaderPanelRef?.loadLazyRootNodes();
    }
  }

  @Watch('options')
  handleWatchOptions() {
    console.log(this.options);
  }

  @Watch('checkedNodes')
  @Watch('showAllLevels')
  @Watch('separator')
  @Watch('props')
  handleCalculatePresentText() {
    if (this.checkedNodes && this.checkedNodes[0]) {
      this.presentText = this.props.multiple
        ? ""
        : this.checkedNodes[0]?.calcText(
            this.showAllLevels,
            this.separator
          );
    } else {
      this.presentText = "";
    }
  }

  @Watch('presentText')
  handleWatchPresentText() {
    this.syncPresentTextValue();
  }

  @Watch('searchInputValue')
  @Watch('inputValue')
  @Watch('multiple')
  handleUpdateSearchKeyword() {
    this.searchKeyword = this.props.multiple ? this.searchInputValue : this.inputValue;
  }

  @Watch('multiple')
  @Watch('collapseTags')
  @Watch('maxCollapseTags')
  @Watch('tags')
  handleUpdateShowTagList() {
    if (!this.props.multiple) {
      this.showTagList = [];
      return;
    }

    this.showTagList = this.collapseTags
      ? this.tags.slice(0, this.maxCollapseTags)
      : this.tags;
  }

  render() {
    const cascaderKls = classNames(
      ns.b(),
      ns.m(this.realSize),
      ns.is("disabled", this.isDisabled),
      this.el.className
    );

    const { t } = state.i18n;

    return (
      <Host>
        <zane-tippy
          appendTo={document.body}
          arrow={false}
          hideOnClick={false}
          interactive={true}
          maxWidth={''}
          boxClass={this.popperBoxClass || ns.b('tippy-box')}
          contentClass={this.popperContentClass || ns.b('tippy-content')}
          onClickOutside={this.handleClickOutside}
          onZHide={this.handleHide}
          placement={this.placement}
          ref={(el) => (this.tooltipRef = el)}
          theme={this.popperTheme}
          popperOptions={this.popperOptions}
          role="cascader"
          trigger="manual"
        >
          <div
            class={cascaderKls}
            onClick={this.handleClick}
            onKeyDown={this.handleKeyDown}
            onMouseEnter={() => (this.inputHover = true)}
            onMouseLeave={() => (this.inputHover = false)}
            ref={(el) => (this.wrapperRef = el)}
            style={this.wrapperStyle}
            tabIndex={this.isDisabled ? -1 : undefined}
          >
            <zane-input
              class={ns.is("focus", this.isFocused)}
              disabled={this.isDisabled}
              onBlur={this.handleBlur}
              onFocus={this.handleFocus}
              onZCompositionEnd={this.handleCompositionEnd}
              onZCompositionStart={this.handleCompositionStart}
              onZCompositionUpdate={this.handleCompositionUpdate}
              placeholder={
                this.searchInputValue ||
                this.tags.length > 0 ||
                this.isComposing
                  ? ""
                  : this.placeholder
              }
              readonly={!this.filterable || this.props.multiple}
              ref={(el) => (this.inputRef = el)}
              size={this.realSize}
              validateEvent={false}
              value={this.inputValue}
            >
              {this.hasPrefixSlot && <slot name="prefix"></slot>}
              <div slot="suffix">
                {this.getClearBtnVisible() ? (
                  <zane-icon
                    class={[nsInput.e("icon"), "icon-circle-close"].join(" ")}
                    key="clear"
                    name={this.clearIcon}
                    onClick={this.handleClear}
                  ></zane-icon>
                ) : (
                  <zane-icon
                    class={[
                      nsInput.e("icon"),
                      "icon-arrow-down",
                      ns.is("reverse", this.popperVisible),
                    ].join(" ")}
                    key="arrow-down"
                    name="arrow-down-s-line"
                  ></zane-icon>
                )}
              </div>
            </zane-input>

            {this.props.multiple && (
              <div
                class={[
                  ns.e("tags"),
                  ns.is(
                    "validate",
                    !!this.formItemContext?.value.validateState
                  ),
                ].join(" ")}
                ref={(el) => (this.tagWrapper = el)}
              >
                {this.renderTags
                  ? this.handleTagsRender(this.tags, this.deleteTag)
                  : this.showTagList.map((tag: Tag) => (
                      <zane-tag
                        key={tag.key}
                        type={this.tagType}
                        size={this.tagSize}
                        effect={this.tagEffect}
                        hit={tag.hitState}
                        closeable={tag.closable}
                        onZClose={() => this.deleteTag(tag)}
                        style={{
                          width: '100%'
                        }}
                      >
                        <span>{ tag.text }</span>
                      </zane-tag>
                    ))}

                {(this.collapseTags &&
                  this.tags.length > this.maxCollapseTags) && (
                    <zane-tippy
                      ref={(el) => (this.tagTooltipRef = el)}
                      disabled={this.popperVisible || !this.collapseTagsTooltip}
                      placement="bottom-start"
                      interactive={true}
                      theme={this.popperTheme}
                    >
                      <zane-tag
                        closeable={false}
                        size={this.tagSize}
                        type={this.tagType}
                        effect={this.tagEffect}
                      >
                        <span class={ns.e("tags-text")}>
                          + {this.tags.length - this.maxCollapseTags}
                        </span>
                      </zane-tag>
                      <div slot="content" style={{ padding: '4px'}}>
                        <zane-scrollbar
                          maxHeight={this.maxCollapseTagsTooltipHeight}
                        >
                          <div class={ns.e("collapse-tags")}>
                            {this.collapseTagList.map((tag, idx) => (
                              <div key={idx} class={ns.e("collapse-tag")}>
                                <zane-tag
                                  key={tag.key}
                                  class="in-tooltip"
                                  type={this.tagType}
                                  size={this.tagSize}
                                  effect={this.tagEffect}
                                  hit={tag.hitState}
                                  closeable={tag.closable}
                                  onZClose={() => this.deleteTag(tag)}
                                >
                                  <span>{tag.text}</span>
                                </zane-tag>
                              </div>
                            ))}
                          </div>
                        </zane-scrollbar>
                      </div>
                    </zane-tippy>
                  )}
                {this.filterable && !this.isDisabled && (
                  <input
                    type="text"
                    value={this.searchInputValue}
                    class={ns.e("search-input")}
                    placeholder={
                      this.presentText ? "" : this.getInputPlaceholder()
                    }
                    onInput={
                      (e) => {
                        if (e.data) {
                          this.searchInputValue = e.data;
                          this.handleInput(e.data, e as InputEvent);
                        }
                      }
                    }
                    onClick={this.handleSearchInputClick}
                    onKeyDown={this.handleSearchInputKeyDown}
                    onCompositionend={this.handleCompositionEnd}
                    onCompositionstart={this.handleCompositionStart}
                    onCompositionupdate={this.handleCompositionUpdate}
                  />
                )}
              </div>
            )}
          </div>
          <div slot="content" class={ns.b()}>
            {this.hasHeaderSlot && (
              <div class={ns.e("header")} onClick={(e) => e.stopPropagation()}>
                <slot name="header"></slot>
              </div>
            )}
            <zane-cascader-panel
              ref={(el) => (this.cascaderPanelRef = el)}
              style={{
                display: this.filtering ? "none" : undefined,
              }}
              value={cloneDeep(this.value)}
              options={this.options}
              props={this.props}
              border={false}
              renderLabel={this.renderLabel}
              onZExpandChange={this.handleExpandChange}
              onZClose={this.handlePanelClose}
              onZChange={this.handlePanelChange}
            >
              <div slot="empty">
                <slot name="empty"></slot>
              </div>
            </zane-cascader-panel>

            {this.filterable && (
              <zane-scrollbar
                style={{
                  display: this.filtering ? undefined : "none",
                }}
                ref={(el) => (this.suggestionPanel = el)}
                class={ns.e("suggestion-panel")}
                viewClass={ns.e("suggestion-list")}
                onKeyDown={this.handleSuggestionKeyDown}
              >
                {
                  this.suggestions?.length
                    ? this.renderSuggestion
                      ? this.renderSuggestion(this.suggestions)
                      : this.suggestions.length && this.suggestions.map((item) => (
                          <div
                            key={item.uid}
                            class={classNames(
                              ns.e("suggestion-item"),
                              ns.is("checked", item.checked)
                            )}
                            tabIndex={-1}
                            onClick={() => this.handleSuggestionClick(item)}
                          >
                            <span>{item.text}</span>
                            {item.checked && <zane-icon name="check-line"></zane-icon>}
                          </div>
                        )
                      )
                    : (<slot name="empty">
                      <div class={ns.e('empty-text')}>
                        { t('cascader.noMatch') }
                      </div>
                    </slot>)
                }
              </zane-scrollbar>
            )}
            {
              this.hasFooterSlot && (
                <div class={ns.e("footer")} onClick={(e) => e.stopPropagation()}>
                  <slot name="footer"></slot>
                </div>
              )
            }
          </div>
        </zane-tippy>
      </Host>
    );
  }

  private getClearBtnVisible = () => {
    if (
      !this.clearable ||
      this.isDisabled ||
      this.filtering ||
      (!this.inputHover && !this.isFocused)
    ) {
      return false;
    }
    return !!this.checkedNodes?.length;
  };

  private getValueOnClear = () => {
    if (isFunction(this.valueOnClear)) {
      return this.valueOnClear();
    } else if (this.valueOnClear !== undefined) {
      return this.valueOnClear;
    } else if (isFunction(this.configProviderContext?.value.valueOnClear)) {
      return this.configProviderContext?.value.valueOnClear();
    } else if (this.configProviderContext?.value.valueOnClear !== undefined) {
      return this.configProviderContext?.value.valueOnClear;
    }
    return DEFAULT_VALUE_ON_CLEAR;
  };

  private getInputPlaceholder = () => {
    const { t } = state.i18n;
    return this.placeholder ?? t("cascader.placeholder");
  };

  private getInputInnerHeight = (inputInner: HTMLElement): number => {
    const key = nsInput.cssVarName('input-height');
    const value = window.getComputedStyle(inputInner).getPropertyValue(key)?.trim()

    return Number.parseFloat(value) - 2;
  }

  private genTag = (node: CascaderNode): Tag => {
    return {
      node,
      key: node.uid,
      text: node.calcText(this.showAllLevels, this.separator),
      hitState: false,
      closable: !this.isDisabled && !node.isDisabled,
    }
  }

  private deleteTag = (tag: Tag) => {
    const node = tag.node as CascaderNode;
    node.doCheck(false);
    this.cascaderPanelRef?.calculateCheckedValue();
    this.removeTagEvent?.emit(node.valueByOption);
  };

  private handleBlur = async (event: FocusEvent) => {
    const isFocusInsideTooltipContent =
      await this.tooltipRef?.isFocusInsideContent(event);

    const isFocusInsideTagTooltipContent =
      await this.tagTooltipRef?.isFocusInsideContent(event);

    const cancelBlur =
      isFocusInsideTooltipContent || isFocusInsideTagTooltipContent;

    if (
      this.isDisabled ||
      (event.relatedTarget &&
        this.wrapperRef?.contains(event.relatedTarget as Node)) ||
      cancelBlur
    ) {
      return;
    }

    this.isFocused = false;
    this.blurEvent?.emit(event);
    if (this.validateEvent) {
      this.formItemContext?.value
        .validate("blur")
        .catch((error) => debugWarn(error));
    }
  };

  private handleClear = async (event: MouseEvent) => {
    event.stopPropagation();
    await this.cascaderPanelRef?.clearCheckedNodes();
    if (!this.popperVisible && this.filterable) {
      this.syncPresentTextValue();
    }
    this.togglePopperVisible(false);
    this.clearEvent?.emit();
  };

  private handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    this.togglePopperVisible(
      !this.filterable || this.props.multiple ? undefined : true
    );
    // if (
    //   this.isDisabled ||
    //   isFocusable(event.target as HTMLElement) ||
    //   (this.wrapperRef?.contains(document.activeElement) &&
    //     this.wrapperRef !== document.activeElement)
    // ) {
    //   return;
    // }

    // this.inputRef?.focus();
  };

  private handleExpandChange = (e: CustomEvent<CascaderNodePathValue>) => {
    this.updatePopperPosition();
    this.expandChangeEvent?.emit(e.detail);
  };

  private handlePanelClose = () => {
    nextFrame(() => {
      this.togglePopperVisible(false);
    });
  };

  private handlePanelChange = (
    e: CustomEvent<CascaderValue | undefined | null>
  ) => {
    this.value = e.detail ?? this.getValueOnClear();
    this.checkedNodes = this.cascaderPanelRef?.checkedNodes;

    this.changeEvent?.emit(cloneDeep(this.value));

    if (this.validateEvent) {
      this.formItemContext?.value
        .validate("change")
        .catch((error) => debugWarn(error));
    }
  };

  private handleClickOutside = () => {
    this.popperVisible = false;
  };

  private handleTagsRender = (tags: Tag[], deleteTag: (tag: Tag) => void) => {
    const tagHtml = this.renderTags?.(tags, deleteTag);
    if (tagHtml) {
      this.tagWrapper?.appendChild(tagHtml);
    }
  };

  private handleCompositionEnd = (event: CustomEvent<CompositionEvent> | CompositionEvent) => {
    const e = event instanceof CompositionEvent ? event : event.detail;
    this.compositionendEvent?.emit(e);
    if (this.isComposing) {
      this.isComposing = false;
      nextFrame(() => {
        const text = (e.target as HTMLInputElement)?.value;
        this.handleInput(text);
      });
    }
  };

  private handleCompositionStart = (event: CustomEvent<CompositionEvent> | CompositionEvent) => {
    const e = event instanceof CompositionEvent ? event : event.detail;
    this.compositionstartEvent?.emit(e);
    this.isComposing = true;
  };

  private handleCompositionUpdate = (event: CustomEvent<CompositionEvent> | CompositionEvent) => {
    const e = event instanceof CompositionEvent ? event : event.detail;
    this.compositionupdateEvent?.emit(e);
    const text = (event.target as HTMLInputElement)?.value;
    const lastCharacter = text[text.length - 1] || "";
    this.isComposing = !isKorean(lastCharacter);
  };

  private handleFilter = debounce(() => {
    const keyword = this.searchKeyword;
    if (!keyword) {
      return;
    }

    const passed = this.beforeFilter(keyword);

    if (isPromise(passed)) {
      passed.then(this.calculateSuggestions).catch(() => {
        /* prevent log error */
      });
    } else if (passed !== false) {
      this.calculateSuggestions();
    } else {
      this.hideSuggestionPanel();
    }
  }, this.debounce);

  private handleFocus = async (event: FocusEvent) => {
    const isFocusInsideTooltipContent =
      await this.tooltipRef?.isFocusInsideContent(event);

    const isFocusInsideTagTooltipContent =
      await this.tagTooltipRef?.isFocusInsideContent(event);

    const cancelFocus =
      isFocusInsideTooltipContent || isFocusInsideTagTooltipContent;

    if (this.isDisabled || this.isFocused || cancelFocus) {
      return;
    }

    this.isFocused = true;
    this.focusEvent?.emit(event);
    if (this.validateEvent) {
      this.formItemContext?.value
        .validate("blur")
        .catch((error) => debugWarn(error));
    }
  };

  private handleHide = () => {
    this.filtering = false;
  };

  private handleInput = (val: string, e?: InputEvent) => {
    this.tooltipRef?.isVisible().then((visible: boolean) => {
      if (!visible) {
        this.togglePopperVisible(true);
      }
    });

    if (e?.isComposing) {
      return;
    }

    val ? this.handleFilter() : this.hideSuggestionPanel();
  };

  private focusFirstNode = () => {
    let firstNode: HTMLElement | null | undefined = null;

    if (this.filtering && this.suggestionPanel) {
      firstNode = this.suggestionPanel?.querySelector(
        `.${ns.e('suggestion-item')}`
      )
    } else {
      firstNode = this.cascaderPanelRef?.querySelector(
        `.${ns.b('node')}[tabindex="-1"]`
      )
    }

    if (firstNode) {
      firstNode.focus()
      !this.filtering && firstNode.click();
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isComposing) return;

    const code = getEventCode(e)

    switch (code) {
      case EVENT_CODE.enter:
      case EVENT_CODE.numpadEnter:
        this.togglePopperVisible()
        break
      case EVENT_CODE.down:
        this.togglePopperVisible(true)
        nextFrame(() => {
          this.focusFirstNode();
        });
        e.preventDefault()
        break
      case EVENT_CODE.esc:
        if (this.popperVisible === true) {
          e.preventDefault()
          e.stopPropagation()
          this.togglePopperVisible(false);
        }
        break
      case EVENT_CODE.tab:
        this.togglePopperVisible(false);
        break
    }
  };

  private handleSuggestionKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const code = getEventCode(e);

    switch (code) {
      case EVENT_CODE.up:
      case EVENT_CODE.down: {
        e.preventDefault();
        const distance = code === EVENT_CODE.up ? -1 : 1;
        focusNode(
          getSibling(
            target,
            distance,
            `.${ns.e("suggestion-item")}[tabindex="-1"]`
          ) as HTMLElement
        );
        break;
      }
      case EVENT_CODE.enter:
      case EVENT_CODE.numpadEnter:
        target.click();
        break;
    }
  };

  private handleSuggestionClick = (node: CascaderNode) => {
    const { checked } = node;

    if (this.props.multiple) {
      this.cascaderPanelRef?.handleCheckChange(node, !checked, false);
    } else {
      !checked && this.cascaderPanelRef?.handleCheckChange(node, true, false);
      this.togglePopperVisible(false);
    }
  };

  private handleSearchInputClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.togglePopperVisible(true);
  };

  private handleSearchInputKeyDown = (e: KeyboardEvent) => {
    const code = getEventCode(e);
    if (code === EVENT_CODE.delete) {
    }
  };

  private hideSuggestionPanel = () => {
    this.filtering = false;
  };

  private syncPresentTextValue = () => {
    this.inputValue = this.presentText;
    this.searchInputValue = this.presentText;
  };

  private togglePopperVisible = (visible?: boolean) => {
    if (this.isDisabled) {
      return;
    }

    visible = visible ?? !this.popperVisible;

    if (visible !== this.popperVisible) {
      this.popperVisible = visible;
      this.inputRef?.getInput().then((nativeInput: HTMLInputElement) => {
        nativeInput?.setAttribute("aria-expanded", `${visible}`);
      });

      if (visible) {
        this.updatePopperPosition();
        if (this.cascaderPanelRef) {
          nextFrame(() => {
            this.cascaderPanelRef?.scrollToExpandingNode();
          });
        }
      } else {
        this.syncPresentTextValue();
      }
    }
  };

  private updatePopperPosition = () => {
    nextFrame(() => {
      this.tooltipRef?.updateTippyProps();
    });
  };

  private updateStyle = async () => {
    const inputInner = await this.inputRef?.getInput();
    if (!isClient || !inputInner) {
      return;
    }

    if (this.suggestionPanel) {
      const suggestionList: HTMLElement | null = this.suggestionPanel.querySelector(
        `.${ns.e("suggestion-list")}`
      );
      if (suggestionList) {
        suggestionList.style.minWidth = `${inputInner.offsetWidth}px`;
      }
    }

    if (this.inputInitialHeight === 0) {
      this.inputInitialHeight = this.getInputInnerHeight(this.inputRef!);
    }

    if (this.tagWrapper) {
      nextFrame(() => {

        const { offsetHeight = 0 } = this.tagWrapper || {};
        const height =
          this.tags.length > 0
            ? `${Math.max(offsetHeight, this.inputInitialHeight)}px`
            : `${this.inputInitialHeight}px`;
        inputInner.style.height = height;
        this.updatePopperPosition();
      })
    }
  };

  private getStrategyCheckedNodes = async (): Promise<CascaderNode[]> => {
    switch (this.showCheckedStrategy) {
      case 'child':
        return this.cascaderPanelRef?.checkedNodes || [];
      case 'parent': {
        const clickedNodes = await this.cascaderPanelRef?.getCheckedNodes(false);
        const clickedNodesValue = clickedNodes!.map((o) => o.value);
        const parentNodes = clickedNodes!.filter(
          (o) => !o.parent || !clickedNodesValue.includes(o.parent.value)
        )
        return parentNodes;
      }
      default:
        return []
    }
  }

  private calculatePresentTags = async () => {
    if (!this.props.multiple) return

    const nodes = await this.getStrategyCheckedNodes();

    const allTags: Tag[] = []
    nodes.forEach((node) => allTags.push(this.genTag(node)))
    this.tags = allTags
  }

  private calculateSuggestions = async () => {
    const nodes = await this.cascaderPanelRef?.getFlattedNodes(
      !this.props.checkStrictly
    );
    const res = nodes?.filter((node) => {
      if (node.isDisabled) return false;
      node.calcText(this.showAllLevels, this.separator);
      return this.filterMethod?.(node, this.searchKeyword);
    });

    if (this.props.multiple) {
      this.tags.forEach((tag) => {
        tag.hitState = false;
      });
    }

    this.filtering = true;
    this.suggestions = res!;
    this.updatePopperPosition();
  };
}
