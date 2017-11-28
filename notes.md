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

## Mount

