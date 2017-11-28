// NOTE: checks if {type} is a react class
function isReactClass(type) {
  return type.prototype && type.prototype.isReactComponent;
}

class CompositeComponent {
  constructor(element) {
    this.currentElement = element;
    // internal instance of rendered component, see mount();
    // eg: const App = ()=> <Foo />;
    // then appInternalInstance.renderedComponent will be fooInternalInstance
    this.renderedComponent = null;
    this.publicInstance = null;
  }
  getPublicInstance() {
    return this.publicInstance
  }
  getHostNode() {
    // recursively get host node
    return this.renderedComponent.getHostNode();
  }
  // NOTE: the update
  receive(nextElement) {
    const { type, props: nextProps } = nextElement;

    // save previous renderedComponent and element
    const previousComponent = this.renderedComponent;
    const previousRenderedElement = previousComponent.currentElement;

    // get next rendered element
    let nextRenderedElement;
    if (isReactClass(type)) {
      const { componentWillUpdate } = this.publicInstance;

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
      previousComponent.receive(nextRenderedElement)
    } else { // otherwise, re-create renderedComponent instance
      this.renderedComponent = instantiateComponent(nextRenderedElement);

      // get dom node of rendered tree
      const nextHostNode = this.renderedComponent.mount();

      const previousHostNode = previousComponent.getHostNode();

      previousComponent.unmount();

      // replace dom node
      previousHostNode.parentNode.replaceChild(nextHostNode, previousHostNode)
    }
  }

  // NOTE: returns DOM tree eventually
  mount() {
    const { type, props } = this.currentElement;
    let renderedElement;

    // es6 class
    if (isReactClass(type)) {
      // NOTE: @publicSInstance becomes an <App> constructor that looks like
      // NOTE:  {props, states, __proto__: { render, componentWillMount... }}
      // NOTE:        -> basically what {this} is in render
      // create public instance
      this.publicInstance = new type(props);
      // record internal instance
      this.publicInstance._reactInternalInstance = this;

      const { componentWillMount } = this.publicInstance;

      // call componentWillMount life-cycle method if exist
      if (typeof componentWillMount === 'function') {
        componentWillMount.call(this.publicInstance);
      }

      // NOTE: `renderedElement` schema: { type, props: { children ... } }
      // get renderedElement by call render method
      renderedElement = this.publicInstance.render();
    } else { // function component
      renderedElement = type(props);
    }

    // NOTE: @recusion
    // * recursivly instatiate renderedElement and mount
    // since it could only be DOM node in the leaf of component tree
    // so the return value of recursive mount method will be DOM node.
    this.renderedComponent = instantiateComponent(renderedElement);

    // NOTE: recusively invokes all its children and mounts them, eventually this will return <DOMNode> instances
    return this.renderedComponent.mount()
  }

  // NOTE: call `componentWillUnmount` if there is such a thing, else unmount its renderedComponent
  unmount() {
    // call componentWillUnmount life-cycle if exist
    if (this.publicInstance && this.publicInstance.componentWillUnmount) {
      this.publicInstance.componentWillUnmount();
    }

    this.renderedComponent.unmount();
  }
}

class DOMComponent {
  constructor(element) {
    this.currentElement = element;
    this.node = null;

    // NOTE: @renderedChildren is stored, so they can be iteratively unmounted on `unmount`, and compared on `receive`
    this.renderedChildren = [];
  }
  getPublicInstance() {
    return this.node;
  }
  getHostNode() {
    return this.node;
  }

  // NOTE: the update
  receive(nextElement) {
    const { props: nextProps } = nextElement;
    // NOTE: Keeps a copy of `previousNode` and `previousProps`
    const { props: previousProps } = this.currentElement;
    const node = this.node;

    // NOTE: update <Element> Tree
    this.currentElement = nextElement;

    // remove old attrs
    Object.keys(previousProps).forEach(function(prop) {
      if (prop !== 'children' && !nextProps.hasOwnProperty(prop)) {
        node.removeAttribute(prop)
      }
    });

    // set next attrs
    Object.keys(nextProps).forEach(function(prop) {
      if (prop !== 'children' && previousProps.hasOwnProperty(prop)) {
        node.setAttribute(prop, nextProps[prop])
      }
    });

    const preChildrenElements = previousProps.children;
    const nextChildrenElements = nextProps.children;

    const previousRenderedChildren = this.renderedChildren
    const nextRenderedChildren = []

    // WARN: lazier than React
    // NOTE: recursively go through nextChildElement, see if exact match for each index in prevChildElement,
    // NOTE: update / append / rebuild
    nextChildrenElements.forEach((nextChildElement, index) => {
      const preChildElement = preChildrenElements[index];

      // replace child node if previous child is text node or type not match
      const needReplace = checkTextNodeElement(preChildElement) || (nextChildElement.type !== preChildElement.type);
      // NOTE: APPEND when no match detected
      if (!preChildElement) {//append new if previous child not exist
        const nextChildComponent = instantiateComponent(nextChildElement);
        nextRenderedChildren.push(nextChildComponent);
        node.appendChild(nextChildComponent.mount());
      } else if (needReplace) {// do replace if need
        // NOTE: REPLACE when TypeMismatch or isTextNode
        // NOTE: interesting `replaceChild` api: (new, old)
        const nextChildComponent = instantiateComponent(nextChildElement);
        nextRenderedChildren.push(nextChildComponent);
        node.replaceChild(nextChildComponent.mount(), previousRenderedChildren[index].getHostNode());
      } else { // update if child type is not text node and not changed
        // NOTE: UPDATE, find the previous Component on the same {index}, and push that for reuse, then call `Component#receive` on the next element tree for the update.
        const previousRenderedComponent = previousRenderedChildren[index];
        nextRenderedChildren.push(previousRenderedComponent);

        // NOTE: recursion
        // call receive on renderedComponent to update recursively
        previousRenderedComponent.receive(nextChildElement);
      }
    });

    // unmount & remove extra child that don't exist
    preChildrenElements.forEach((previousChildElement, index) => {
      if (!nextChildrenElements[index]) {
        const previousRenderedComponent = previousRenderedChildren[index];
        previousRenderedComponent.unmount();

        node.removeChild(previousRenderedComponent.getHostNode());
      }
    });

    this.renderedChildren = nextRenderedChildren;

  }

  // NOTE: @returns node <DOMNode>
  mount() {
    const element = this.currentElement;
    // NOTE: check if element is text node
    const isTextNodeElement = checkTextNodeElement(element);
    let node;

    if (isTextNodeElement) {
      node = document.createTextNode(element);
    } else {
      const { type, props : { children, ...attributes } } = element;

      // NOTE: native
      // create dom node by tag
      node = document.createElement(type);

      // NOTE: native set attribute
      // set attributes of dom node
      Object.keys(attributes).forEach(k => {
        node.setAttribute(k, attributes[k]);
      });

      // WARN: what does this mean? test it out
      // tag without children like <input/> is not supported yet
      // recursively create instance for childrens
      // WARN: note true in react, can return [] with `key`
      // CompositeComponent have only one child -- the component it **renders**: const Parent = ()=> <Child />
      // but HostComponent(DOMComponent) can have multiple children -- the components it **contains**: const App = ()=> <div><A/><B/><C/></div>
      children.forEach(child => {
        // NOTE: child is <Element>, schema: { type, props: { children } }
        const childComponent = instantiateComponent(child);
        this.renderedChildren.push(childComponent)

        // NOTE: recursively call #mount on `childComponent` <DOM or Composite> and append to node NATIVELY
        // call mount to get dom node of child component recursively then append as child node
        // NOTE: childComponent.mount() returns a DOM node
        node.appendChild(childComponent.mount());
      });
    }

    this.node = node;
    return this.node;
  }

  // NOTE: unmount each of its renderedChildren [<Component>], recursion
  unmount() {
    this.renderedChildren.forEach((childComponent) => {
      childComponent.unmount()
    })
  }
}

function checkTextNodeElement(element) {
  return ['string', 'number'].indexOf(typeof element) !== -1;
}

function isCompositeElement(element) {
  return typeof element === 'object' && typeof element.type === 'function';
}

// create internal instance of element
function instantiateComponent(element) {
  return isCompositeElement(element)
    ? new CompositeComponent(element)
    : new DOMComponent(element);
}

window.React = {
  Component: class Component {
    constructor(props) {
      this.props = props;
    }
    setState(nextState){
      const reactComponent = this._reactInternalInstance;

      this.state = Object.assign({}, this.state, nextState);

      if (reactComponent) {
        // NOTE: at this point, `@state` is already updated, and `#render` will return the new <Element> tree
        reactComponent.renderedComponent.receive(this.render())
      }
    }
    get isReactComponent() { return true } // BETTER: changed to getter
  },
  // NOTE: creates a { type, props: { children, ... } } object
  createElement(type, props, ...children) {
    const finalProps = {...props, children};
    return {
      type,
      props: finalProps
    }
  }
};

window.ReactDOM = {
  // NOTE: @param {element} - { type, props: { children, ... } }
  // NOTE: @param {container} - { DOM }
  render(element, container) {

    // NOTE: if container is not empty, has native DOM children
    // NOTE: looks for `_internalInstance`<CompositeComponent> (set in this function),
    // NOTE: then performs update
    // NOTE:      -> basically performs update if rootNode.`firstChild` exists (already rendered)
    // Update if already mounted
    if (container.firstChild) {
      const instance = container.firstChild._internalInstance;
      instance.receive(element);
      return;
    }

    // NOTE: can either be `DOMComponent` or `CompositeComponent`, here though usually its latter
    // create component internal instance
    const rootComponent = instantiateComponent(element);

    // NOTE: node instanceof <DOMNode>
    // create dom node tree
    const node = rootComponent.mount();

    // recored internalInstance on node so we can check & update the dom tree on re-render
    node._internalInstance = rootComponent;

    // NOTE: Native DOM `appendChild`
    // append the dom tree to container
    container.appendChild(node);

    // get public instance see CompositeComponent & DOMComponent
    return rootComponent.getPublicInstance();
  },

  // NOTE: simple enough, find its first and only `internalInstance` and unmount, then empty the container
  unmountComponentAtNode(container) {
    const instance = container.firstChild._internalInstance;
    instance.unmount();
    container.innerHTML = '';
  }
};
