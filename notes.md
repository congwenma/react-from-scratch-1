# Element - { type, { props: { children, ... } } }

# Components - <CompositeComponent> or <DOMComponent>

* publicInstance -
  - What you use for `this.props` and `this.state`
  - Access with `this` or `this._reactInternalInstance.publicInstance`

* internalInstance -
  - <Component> type
  - Access with `this._reactInternalInstance`

* renderedComponent -
  - <Component> type
  - the result of `instantiateComponent(
    this.publicInstance.render()
  )`
  - Access with `this.renderedComponent`
  - e.g., If you have <App/>, which renders <div>...</div>, the `DOMComponent` created from <div> will be `renderedComponent`


# Major Scenarios

## Mount


## Unmount


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

    4. DONE
```