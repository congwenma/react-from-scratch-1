# Element - { type, { props: { children, ... } } }

# Components - <CompositeComponent> or <DOMComponent>

* publicInstance -
  - What you use for `this.props` and `this.state`
  - Access with `this` or `this._reactInternalInstance.publicInstance`

* internalInstance -
  - <Component> type, could be <Composite*> or <DOM*>
  - Access with `this._reactInternalInstance`

* renderedComponent -
  - <Component> type
  - the result of `instantiateComponent(
    this.publicInstance.render()
  )`
  - Access with `this.renderedComponent`
  - e.g., If you have <App/>, which renders <div>...</div>, the `DOMComponent` created from <div> will be `renderedComponent`


# Major Scenarios

## Unmount
```js
ReactDOM.unmountComponentAtNode(DOMNode node) ->
  1. find its first and only child's `internalInstance` and unmount it
  2. calls `internalInstance.unmount`
    2.1 if instance instanceof CompositeCoponent
      2.1.1 if there is such a thing, run `instance.publicInstance.componentWillUnmount`
      2.1.2 unmount `instance.renderedComponent`, which basically is`firstChild`
      2.1.3 Recursion on 2.1.2 to 2 and unmounts all leaves

    2.2 if instance instanceof DOMComponent
      2.2.1 iterate all of `instance.renderedChildren` and unmount each of them
      2.2.2 Recursion on 2.2.1 to 2 and unmounts all leaves

    2.3. DONE
  3. empties `innerHTML` on the `node`
```


## SetState

```js
myComponent.setState(Object nextState) ->
  Component#setState(Object nextState) ->
    1. gets internal instance `_reactInternalInstance` and get its renderedComponent,
    2. calls the render on the updated `@state`, which returns an <Element>,
    3. pass the <Element> into `renderedComponent#receive`
    internalInstance.renderedComponent.receive(this.newRender()) ->
      3.1. unset and set attributes
      3.2. use basic comparison based on `Element@type` to determine if the change require the <Component> to `APPEND`, `REPLACE` or `UPDATE`.
      receive
      3.3. Recusrively call children to receive (back to 3)

    4. DONE~~~
```

## Mount (Complex)

```js
ReactDOM.render(Element element, DOMNode container) ->
  1. Check if container is already mounted by asking for `container.firstChild._internalInstance`, if found, call `instance.receive(element)` to perform an update and returns

  2. construct `rootComponent` by calling `instantiateComponent(element)`
    2.1 check if the element is <CompositeComponent> or <DOMComponent>
    2.2 builds the corresponding Component and return it

  3. mount `rootComponent` and get the <DOMNode> returned
    3.1 computes `renderedElement` = if rootComponent instanceof CompositeComponent
      3.1.1 grab `currentElement`

      3.1.2 if `currentElement.type` is ReactComponent, construct a ReactComponent
        3.1.2.1 construct `@publicInstance`
        3.1.2.2 set internal instance,`@publicInstance._reactInternalInstance = this`
        3.1.2.3 invoke `componentWillMount` on `@publicInstance` if exist
        3.1.2.4 set `renderedElement = @publicInstance.render()`

      3.1.3 if `currentElement.type` is a function
        3.1.3.1 construct a "function component", `renderedElement = type(props)`

    3.2 set `@rendereComponent` = instantiateComponent(renderedElement)

    3.3 returns the mounted `@renderedComponent`
    3.4 Recursion from 3.3 mounts all children elements.
    3.5 DONE

  4. set `_internalInstance` on the <DOMNode>

  5. take that DOMNode from 4 and insert it into `container`

  6. return `rootComponent`s public instance (not sure what that is for)
```