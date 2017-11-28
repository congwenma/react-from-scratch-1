'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// NOTE: checks if {type} is a react class
function isReactClass(type) {
  return type.prototype && type.prototype.isReactComponent;
}

var CompositeComponent = function () {
  function CompositeComponent(element) {
    _classCallCheck(this, CompositeComponent);

    this.currentElement = element;
    // internal instance of rendered component, see mount();
    // eg: const App = ()=> <Foo />;
    // then appInternalInstance.renderedComponent will be fooInternalInstance
    this.renderedComponent = null;
    this.publicInstance = null;
  }

  _createClass(CompositeComponent, [{
    key: 'getPublicInstance',
    value: function getPublicInstance() {
      return this.publicInstance;
    }
  }, {
    key: 'getHostNode',
    value: function getHostNode() {
      // recursively get host node
      return this.renderedComponent.getHostNode();
    }
    // NOTE: the update

  }, {
    key: 'receive',
    value: function receive(nextElement) {
      var type = nextElement.type,
          nextProps = nextElement.props;

      // save previous renderedComponent and element

      var previousComponent = this.renderedComponent;
      var previousRenderedElement = previousComponent.currentElement;

      // get next rendered element
      var nextRenderedElement = void 0;
      if (isReactClass(type)) {
        var componentWillUpdate = this.publicInstance.componentWillUpdate;


        if (typeof componentWillUpdate === 'function') {
          componentWillUpdate.call(this.publicInstance, this.currentElement.props);
        }

        this.publicInstance.props = nextProps;
        nextRenderedElement = this.publicInstance.render();
      } else {
        nextRenderedElement = type(nextProps);
      }

      // next element type might be different from previous
      // eg: const App = ({areYouOk})=> areYouOk ? <Congratulations /> : <GoodLuck />
      // if type not changed, just call receive on previous renderedComponent
      if (nextRenderedElement.type === previousRenderedElement.type) {
        previousComponent.receive(nextRenderedElement);
      } else {
        // otherwise, re-create renderedComponent instance
        this.renderedComponent = instantiateComponent(nextRenderedElement);

        // get dom node of rendered tree
        var nextHostNode = this.renderedComponent.mount();

        var previousHostNode = previousComponent.getHostNode();

        previousComponent.unmount();

        // replace dom node
        previousHostNode.parentNode.replaceChild(nextHostNode, previousHostNode);
      }
    }

    // NOTE: returns DOM tree eventually

  }, {
    key: 'mount',
    value: function mount() {
      var _currentElement = this.currentElement,
          type = _currentElement.type,
          props = _currentElement.props;

      var renderedElement = void 0;

      // es6 class
      if (isReactClass(type)) {
        // NOTE: @publicSInstance becomes an <App> constructor that looks like
        // NOTE:  {props, states, __proto__: { render, componentWillMount... }}
        // NOTE:        -> basically what {this} is in render
        // create public instance
        this.publicInstance = new type(props);
        // record internal instance
        this.publicInstance._reactInternalInstance = this;

        var componentWillMount = this.publicInstance.componentWillMount;

        // call componentWillMount life-cycle method if exist

        if (typeof componentWillMount === 'function') {
          componentWillMount.call(this.publicInstance);
        }

        // NOTE: `renderedElement` schema: { type, props: { children ... } }
        // get renderedElement by call render method
        renderedElement = this.publicInstance.render();
      } else {
        // function component
        renderedElement = type(props);
      }

      // NOTE: @recusion
      // * recursivly instatiate renderedElement and mount
      // since it could only be DOM node in the leaf of component tree
      // so the return value of recursive mount method will be DOM node.
      this.renderedComponent = instantiateComponent(renderedElement);

      // NOTE: recusively invokes all its children and mounts them, eventually this will return <DOMNode> instances
      return this.renderedComponent.mount();
    }
  }, {
    key: 'unmount',
    value: function unmount() {
      // call componentWillUnmount life-cycle if exist
      if (this.publicInstance && this.publicInstance.componentWillUnmount) {
        this.publicInstance.componentWillUnmount();
      }

      this.renderedComponent.unmount();
    }
  }]);

  return CompositeComponent;
}();

var DOMComponent = function () {
  function DOMComponent(element) {
    _classCallCheck(this, DOMComponent);

    this.currentElement = element;
    this.node = null;

    // NOTE: @renderedChildren is stored, so they can be iteratively unmounted on `unmount`, and compared on `receive`
    this.renderedChildren = [];
  }

  _createClass(DOMComponent, [{
    key: 'getPublicInstance',
    value: function getPublicInstance() {
      return this.node;
    }
  }, {
    key: 'getHostNode',
    value: function getHostNode() {
      return this.node;
    }

    // NOTE: the update

  }, {
    key: 'receive',
    value: function receive(nextElement) {
      var nextProps = nextElement.props;
      // NOTE: Keeps a copy of `previousNode` and `previousProps`

      var previousProps = this.currentElement.props;

      var node = this.node;

      // NOTE: update <Element> Tree
      this.currentElement = nextElement;

      // remove old attrs
      Object.keys(previousProps).forEach(function (prop) {
        if (prop !== 'children' && !nextProps.hasOwnProperty(prop)) {
          node.removeAttribute(prop);
        }
      });

      // set next attrs
      Object.keys(nextProps).forEach(function (prop) {
        if (prop !== 'children' && previousProps.hasOwnProperty(prop)) {
          node.setAttribute(prop, nextProps[prop]);
        }
      });

      var preChildrenElements = previousProps.children;
      var nextChildrenElements = nextProps.children;

      var previousRenderedChildren = this.renderedChildren;
      var nextRenderedChildren = [];

      // WARN: lazier than React
      // NOTE: recursively go through nextChildElement, see if exact match for each index in prevChildElement,
      // NOTE: update / append / rebuild
      nextChildrenElements.forEach(function (nextChildElement, index) {
        var preChildElement = preChildrenElements[index];

        // replace child node if previous child is text node or type not match
        var needReplace = checkTextNodeElement(preChildElement) || nextChildElement.type !== preChildElement.type;
        // NOTE: APPEND when no match detected
        if (!preChildElement) {
          //append new if previous child not exist
          var nextChildComponent = instantiateComponent(nextChildElement);
          nextRenderedChildren.push(nextChildComponent);
          node.appendChild(nextChildComponent.mount());
        } else if (needReplace) {
          // do replace if need
          // NOTE: REPLACE when TypeMismatch or isTextNode
          // NOTE: interesting `replaceChild` api: (new, old)
          var _nextChildComponent = instantiateComponent(nextChildElement);
          nextRenderedChildren.push(_nextChildComponent);
          node.replaceChild(_nextChildComponent.mount(), previousRenderedChildren[index].getHostNode());
        } else {
          // update if child type is not text node and not changed
          // NOTE: UPDATE, find the previous Component on the same {index}, and push that for reuse, then call `Component#receive` on the next element tree for the update.
          var previousRenderedComponent = previousRenderedChildren[index];
          nextRenderedChildren.push(previousRenderedComponent);

          // NOTE: recursion
          // call receive on renderedComponent to update recursively
          previousRenderedComponent.receive(nextChildElement);
        }
      });

      // unmount & remove extra child that don't exist
      preChildrenElements.forEach(function (previousChildElement, index) {
        if (!nextChildrenElements[index]) {
          var previousRenderedComponent = previousRenderedChildren[index];
          previousRenderedComponent.unmount();

          node.removeChild(previousRenderedComponent.getHostNode());
        }
      });

      this.renderedChildren = nextRenderedChildren;
    }
  }, {
    key: 'mount',
    value: function mount() {
      var _this = this;

      var element = this.currentElement;
      // NOTE: check if element is text node
      var isTextNodeElement = checkTextNodeElement(element);
      var node = void 0;

      if (isTextNodeElement) {
        node = document.createTextNode(element);
      } else {
        var type = element.type,
            _element$props = element.props,
            children = _element$props.children,
            attributes = _objectWithoutProperties(_element$props, ['children']);

        // NOTE: native
        // create dom node by tag


        node = document.createElement(type);

        // NOTE: native set attribute
        // set attributes of dom node
        Object.keys(attributes).forEach(function (k) {
          node.setAttribute(k, attributes[k]);
        });

        // WARN: what does this mean? test it out
        // tag without children like <input/> is not supported yet
        // recursively create instance for childrens
        // WARN: note true in react, can return [] with `key`
        // CompositeComponent have only one child -- the component it **renders**: const Parent = ()=> <Child />
        // but HostComponent(DOMComponent) can have multiple children -- the components it **contains**: const App = ()=> <div><A/><B/><C/></div>
        children.forEach(function (child) {
          // NOTE: child is <Element>, schema: { type, props: { children } }
          var childComponent = instantiateComponent(child);
          _this.renderedChildren.push(childComponent);

          // NOTE: recursively call #mount on `childComponent` <DOM or Composite> and append to node NATIVELY
          // call mount to get dom node of child component recursively then append as child node
          // NOTE: childComponent.mount() returns a DOM node
          node.appendChild(childComponent.mount());
        });
      }

      this.node = node;
      return this.node;
    }
  }, {
    key: 'unmount',
    value: function unmount() {
      this.renderedChildren.forEach(function (childComponent) {
        childComponent.unmount();
      });
    }
  }]);

  return DOMComponent;
}();

function checkTextNodeElement(element) {
  return ['string', 'number'].indexOf(typeof element === 'undefined' ? 'undefined' : _typeof(element)) !== -1;
}

function isCompositeElement(element) {
  return (typeof element === 'undefined' ? 'undefined' : _typeof(element)) === 'object' && typeof element.type === 'function';
}

// create internal instance of element
function instantiateComponent(element) {
  return isCompositeElement(element) ? new CompositeComponent(element) : new DOMComponent(element);
}

window.React = {
  Component: function () {
    function Component(props) {
      _classCallCheck(this, Component);

      this.props = props;
    }

    _createClass(Component, [{
      key: 'setState',
      value: function setState(nextState) {
        var reactComponent = this._reactInternalInstance;

        this.state = Object.assign({}, this.state, nextState);

        if (reactComponent) {
          // NOTE: at this point, `@state` is already updated, and `#render` will return the new <Element> tree
          reactComponent.renderedComponent.receive(this.render());
        }
      }
    }, {
      key: 'isReactComponent',
      get: function get() {
        return true;
      } // BETTER: changed to getter

    }]);

    return Component;
  }(),
  // NOTE: creates a { type, props: { children, ... } } object
  createElement: function createElement(type, props) {
    for (var _len = arguments.length, children = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      children[_key - 2] = arguments[_key];
    }

    var finalProps = _extends({}, props, { children: children });
    return {
      type: type,
      props: finalProps
    };
  }
};

window.ReactDOM = {
  // NOTE: @param {element} - { type, props: { children, ... } }
  // NOTE: @param {container} - { DOM }
  render: function render(element, container) {

    // NOTE: if container is not empty, has native DOM children
    // NOTE: looks for `_internalInstance`<CompositeComponent> (set in this function),
    // NOTE: then performs update
    // NOTE:      -> basically performs update if rootNode.`firstChild` exists (already rendered)
    // Update if already mounted
    if (container.firstChild) {
      var instance = container.firstChild._internalInstance;
      instance.receive(element);
      return;
    }

    // NOTE: can either be `DOMComponent` or `CompositeComponent`, here though usually its latter
    // create component internal instance
    var rootComponent = instantiateComponent(element);

    // NOTE: node instanceof <DOMNode>
    // create dom node tree
    var node = rootComponent.mount();

    // recored internalInstance on node so we can check & update the dom tree on re-render
    node._internalInstance = rootComponent;

    // NOTE: Native DOM `appendChild`
    // append the dom tree to container
    container.appendChild(node);

    // get public instance see CompositeComponent & DOMComponent
    return rootComponent.getPublicInstance();
  },
  unmountComponentAtNode: function unmountComponentAtNode(container) {
    var instance = container.firstChild._internalInstance;
    instance.unmount();
    container.innerHTML = '';
  }
};
