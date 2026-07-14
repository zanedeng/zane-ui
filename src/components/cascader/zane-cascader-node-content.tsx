
import { Component, h, Prop, Element, State } from '@stencil/core';
import type { CascaderNode } from './node';
import { getCascaderPanelContext } from './utils';
import { nextFrame, type ReactiveObject } from '../../utils';
import type { CascaderPanelContext, RenderLabel } from './types';
import { useNamespace } from '../../hooks';

const ns = useNamespace('cascader-node')

@Component({
  tag: 'zane-cascader-node-content',
})
export class ZaneCascaderNodeContent {
  @Element() el!: HTMLElement;
  
  @Prop() node?: CascaderNode;

  @State() renderLabelFn?: RenderLabel;

  private cascaderPanelContext?: ReactiveObject<CascaderPanelContext>;

  private contentRef?: HTMLSpanElement;

  componentWillLoad() {
    this.cascaderPanelContext = getCascaderPanelContext(this.el);
    this.renderLabelFn = this.cascaderPanelContext?.value.renderLabel;

    this.cascaderPanelContext?.change$.subscribe(({ key, value }) => {
      if (key === 'renderLabel') {
        this.renderLabelFn = value;
      }
    });
  }

  private renderLabel = () => {
    const renderEl = this.renderLabelFn?.({ node: this.node, data: this.node?.data });
    if (renderEl) {
      nextFrame(() => {
        this.contentRef?.appendChild(renderEl);
      })
      return;
    }
    return this.node?.label;
  }
  
  render() {
    return (<span ref={(el) => this.contentRef = el} class={ns.e('label')}>
      { this.renderLabel() }
    </span>);
  }

}
