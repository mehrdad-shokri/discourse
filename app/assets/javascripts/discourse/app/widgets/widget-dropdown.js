import I18n from "I18n";
import { createWidget } from "discourse/widgets/widget";
import { schedule } from "@ember/runloop";
import hbs from "discourse/widgets/hbs-compiler";

/*

  widget-dropdown

  Usage
  -----

  {{attach
    widget="widget-dropdown"
    attrs=(hash
      id=id
      label=label
      content=content
      onChange=onChange
      options=(hash)
    )
  }}

  Mandatory attributes:

    - id: must be unique in the application

    - label or translatedLabel:
        - label: an i18n key to be translated and displayed on the header
        - translatedLabel: an already translated label to display on the header

    - onChange: action called when a click happens on a row, content[rowIndex] will be passed as params

  Optional attributes:

    - class: adds css class to the dropdown
    - content: list of items to display, if undefined or empty dropdown won't display
      Example content:

      ```
      [
        { id: 1, label: "foo.bar" },
        "separator",
        { id: 2, translatedLabel: "FooBar" },
        { id: 3 label: "foo.baz", icon: "times" },
        { id: 4, html: "<b>foo</b>" }
      ]
      ```

    - options: accepts a hash of optional attributes
      - headerClass: adds css class to the dropdown header
      - bodyClass: adds css class to the dropdown header
      - caret: adds a caret to visually enforce this is a dropdown
*/

export const WidgetDropdownHeaderClass = {
  tagName: "button",

  transform(attrs) {
    return { label: this._buildLabel(attrs) };
  },

  buildAttributes(attrs) {
    return { title: this._buildLabel(attrs) };
  },

  buildClasses(attrs) {
    let classes = ["widget-dropdown-header", "btn", "btn-default"];
    if (attrs.class) {
      classes = classes.concat(attrs.class.split(" "));
    }
    return classes.filter(Boolean).join(" ");
  },

  click(event) {
    event.preventDefault();

    this.sendWidgetAction("_onTrigger");
  },

  template: hbs`
    {{#if attrs.icon}}
      {{d-icon attrs.icon}}
    {{/if}}
    <span class="label">
      {{transformed.label}}
    </span>
    {{#if attrs.caret}}
      {{d-icon "caret-down"}}
    {{/if}}
  `,

  _buildLabel(attrs) {
    return attrs.translatedLabel ? attrs.translatedLabel : I18n.t(attrs.label);
  }
};

createWidget("widget-dropdown-header", WidgetDropdownHeaderClass);

export const WidgetDropdownItemClass = {
  tagName: "div",

  transform(attrs) {
    return {
      content:
        attrs.item === "separator"
          ? "<hr>"
          : attrs.item.html
          ? attrs.item.html
          : attrs.item.translatedLabel
          ? attrs.item.translatedLabel
          : I18n.t(attrs.item.label)
    };
  },

  buildAttributes(attrs) {
    return {
      "data-id": attrs.item.id,
      tabindex: attrs.item === "separator" ? -1 : 0
    };
  },

  buildClasses(attrs) {
    return [
      "widget-dropdown-item",
      attrs.item === "separator" ? "separator" : `item-${attrs.item.id}`
    ].join(" ");
  },

  keyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.sendWidgetAction("_onChange", this.attrs.item);
    }
  },

  click(event) {
    event.preventDefault();

    this.sendWidgetAction("_onChange", this.attrs.item);
  },

  template: hbs`
    {{#if attrs.item.icon}}
      {{d-icon attrs.item.icon}}
    {{/if}}
    {{{transformed.content}}}
  `
};

createWidget("widget-dropdown-item", WidgetDropdownItemClass);

export const WidgetDropdownBodyClass = {
  tagName: "div",

  buildClasses(attrs) {
    return `widget-dropdown-body ${attrs.class || ""}`;
  },

  clickOutside() {
    this.sendWidgetAction("hideBody");
  },

  template: hbs`
    {{#each attrs.content as |item|}}
      {{attach
        widget="widget-dropdown-item"
        attrs=(hash item=item)
      }}
    {{/each}}
  `
};

createWidget("widget-dropdown-body", WidgetDropdownBodyClass);

export const WidgetDropdownClass = {
  tagName: "div",

  init(attrs) {
    if (!attrs) {
      throw "A widget-dropdown expects attributes.";
    }

    if (!attrs.id) {
      throw "A widget-dropdown expects a unique `id` attribute.";
    }

    if (!attrs.label && !attrs.translatedLabel) {
      throw "A widget-dropdown expects at least a `label` or `translatedLabel`";
    }
  },

  buildKey: attrs => {
    return attrs.id;
  },

  buildAttributes(attrs) {
    return { id: attrs.id };
  },

  defaultState() {
    return {
      opened: false
    };
  },

  buildClasses(attrs) {
    const classes = ["widget-dropdown"];
    classes.push(this.state.opened ? "opened" : "closed");
    return classes.join(" ") + " " + (attrs.class || "");
  },

  transform(attrs) {
    return {
      options: attrs.options || {}
    };
  },

  hideBody() {
    this.state.opened = false;
  },

  _onChange(params) {
    this.state.opened = false;

    if (this.attrs.onChange) {
      if (typeof this.attrs.onChange === "string") {
        this.sendWidgetAction(this.attrs.onChange, params);
      } else {
        this.attrs.onChange(params);
      }
    }
  },

  destroy() {
    if (this._popper) {
      this._popper.destroy();
      this._popper = null;
    }
  },

  _onTrigger() {
    this.state.opened = !this.state.opened;

    schedule("afterRender", () => {
      const dropdownHeader = document.querySelector(
        `#${this.attrs.id} .widget-dropdown-header`
      );
      const dropdownBody = document.querySelector(
        `#${this.attrs.id} .widget-dropdown-body`
      );

      if (this.state.opened && dropdownHeader && dropdownBody) {
        if (this.state.popper) {
          this.state.popper.destroy();
        }

        /* global Popper:true */
        this.state.popper = Popper.createPopper(dropdownHeader, dropdownBody, {
          strategy: "fixed",
          placement: "bottom-start",
          modifiers: [
            {
              name: "preventOverflow"
            },
            {
              name: "offset",
              options: {
                offset: [0, 5]
              }
            }
          ]
        });
      }
    });
  },

  template: hbs`
    {{#if attrs.content}}
      {{attach
        widget="widget-dropdown-header"
        attrs=(hash
          icon=attrs.icon
          label=attrs.label
          translatedLabel=attrs.translatedLabel
          class=this.transformed.options.headerClass
          caret=this.transformed.options.caret
        )
      }}

      {{#if this.state.opened}}
        {{attach
          widget="widget-dropdown-body"
          attrs=(hash
            id=attrs.id
            class=this.transformed.options.bodyClass
            content=attrs.content
          )
        }}
      {{/if}}
    {{/if}}
  `
};

export default createWidget("widget-dropdown", WidgetDropdownClass);
