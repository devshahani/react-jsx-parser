import React from 'react'
import ReactDOM from 'react-dom'
import TestUtils from 'react-dom/test-utils'
import JsxParser from './JsxParser'

jest.unmock('acorn-jsx')
jest.unmock('./JsxParser')

/* eslint-disable function-paren-newline, no-console, no-underscore-dangle */

// eslint-disable-next-line react/prop-types
const Custom = ({ children = [], className, text }) => (
  <div className={className}>
    {text}
    {children}
  </div>
)

describe('JsxParser Component', () => {
  let parent = null
  let originalConsoleError = null
  let originalJsDomEmit = null

  beforeAll(() => {
    originalConsoleError = console.error
    console.error = jest.fn()

    originalJsDomEmit = window._virtualConsole.emit
    window._virtualConsole.emit = jest.fn()
  })

  afterAll(() => {
    console.error = originalConsoleError
    window._virtualConsole.emit = originalJsDomEmit
  })

  beforeEach(() => {
    console.error.mockReset()
    window._virtualConsole.emit.mockReset()
    parent = document.createElement('div')
  })

  function render(element) {
    // eslint-disable-next-line react/no-render-return-value
    const component = ReactDOM.render(element, parent)
    return {
      parent,
      component,
      // eslint-disable-next-line react/no-find-dom-node
      rendered: ReactDOM.findDOMNode(component),
    }
  }

  it('renders non-React components', () => {
    const { component, rendered } = render(
      <JsxParser
        jsx={
          '<h1>Header</h1>' +
          '<div class="foo">Foo</div>' +
          '<span class="bar">Bar</span>'
        }
      />
    )

    expect(rendered.classList.contains('jsx-parser')).toBeTruthy()

    expect(component.ParsedChildren).toHaveLength(3)
    expect(rendered.childNodes).toHaveLength(3)

    expect(rendered.childNodes[0].nodeName).toEqual('H1')
    expect(rendered.childNodes[0].textContent).toEqual('Header')

    expect(rendered.childNodes[1].nodeName).toEqual('DIV')
    expect(rendered.childNodes[1].classList.contains('foo')).toBeTruthy()
    expect(rendered.childNodes[1].textContent).toEqual('Foo')

    expect(rendered.childNodes[2].nodeName).toEqual('SPAN')
    expect(rendered.childNodes[2].classList.contains('bar')).toBeTruthy()
    expect(rendered.childNodes[2].textContent).toEqual('Bar')
  })

  it('renders nested components', () => {
    const { component, rendered } = render(
      <JsxParser
        jsx={
          '<div>' +
            'Outer' +
            '<div>Inner</div>' +
          '</div>'
        }
      />
    )

    expect(rendered.classList.contains('jsx-parser')).toBeTruthy()

    expect(component.ParsedChildren).toHaveLength(1)
    expect(rendered.childNodes).toHaveLength(1)

    const outer = rendered.childNodes[0]
    expect(outer.nodeName).toEqual('DIV')
    expect(outer.childNodes).toHaveLength(2)

    const [text, div] = outer.childNodes
    expect(text.nodeType).toEqual(Node.TEXT_NODE) // Text
    expect(text.textContent).toEqual('Outer')

    expect(div.nodeType).toEqual(Node.ELEMENT_NODE) // Element
    expect(div.nodeName).toEqual('DIV')
    expect(div.textContent).toEqual('Inner')
  })

  it('renders custom components', () => {
    const { component, rendered } = render(
      <JsxParser
        components={{ Custom }}
        jsx={
          '<h1>Header</h1>' +
          '<Custom className="blah" text="Test Text" />'
        }
      />
    )

    expect(rendered.classList.contains('jsx-parser')).toBeTruthy()

    expect(component.ParsedChildren).toHaveLength(2)
    expect(rendered.childNodes).toHaveLength(2)

    expect(rendered.childNodes[0].nodeName).toEqual('H1')
    expect(rendered.childNodes[0].textContent).toEqual('Header')

    const custom = component.ParsedChildren[1]
    expect(custom instanceof Custom)
    expect(custom.props.text).toEqual('Test Text')

    const customHTML = rendered.childNodes[1]
    expect(customHTML.nodeName).toEqual('DIV')
    expect(customHTML.textContent).toEqual('Test Text')
  })

  it('renders custom components with nesting', () => {
    const { component, rendered } = render(
      <JsxParser
        components={{ Custom }}
        jsx={
          '<Custom className="outer" text="outerText">' +
            '<Custom className="inner" text="innerText">' +
              '<div>Non-Custom</div>' +
            '</Custom>' +
          '</Custom>'
        }
      />
    )
    expect(component.ParsedChildren).toHaveLength(1)
    expect(rendered.childNodes).toHaveLength(1)

    const outer = rendered.childNodes[0]
    expect(outer.nodeName).toEqual('DIV')
    expect(outer.className).toEqual('outer')
    expect(outer.childNodes).toHaveLength(2)

    const [text, inner] = Array.from(outer.childNodes)
    expect(text.nodeType).toEqual(Node.TEXT_NODE)
    expect(text.textContent).toEqual('outerText')
    expect(inner.nodeType).toEqual(Node.ELEMENT_NODE)
    expect(inner.nodeName).toEqual('DIV')
    expect(inner.className).toEqual('inner')
    expect(inner.childNodes).toHaveLength(2)

    const [innerText, innerDiv] = Array.from(inner.childNodes)
    expect(innerText.nodeType).toEqual(Node.TEXT_NODE)
    expect(innerText.textContent).toEqual('innerText')
    expect(innerDiv.nodeType).toEqual(Node.ELEMENT_NODE)
    expect(innerDiv.nodeName).toEqual('DIV')
    expect(innerDiv.textContent).toEqual('Non-Custom')
  })

  it('handles unrecognized components', () => {
    const { component, rendered } = render(
      <JsxParser
        components={[/* No Components Passed In */]}
        jsx={
          '<Unrecognized class="outer" foo="Foo">' +
            '<Unrecognized class="inner" bar="Bar">' +
              '<div>Non-Custom</div>' +
            '</Unrecognized>' +
          '</Unrecognized>'
        }
      />
    )

    expect(component.ParsedChildren[0].props.foo).toEqual('Foo')
    expect(component.ParsedChildren[0].props.children.props.bar).toEqual('Bar')

    expect(rendered.childNodes).toHaveLength(1)
    const outer = rendered.childNodes[0]
    expect(outer.nodeName).toEqual('UNRECOGNIZED')
    expect(outer.childNodes).toHaveLength(1)

    const inner = outer.childNodes[0]
    expect(inner.nodeName).toEqual('UNRECOGNIZED')
    expect(inner.childNodes).toHaveLength(1)

    const div = inner.childNodes[0]
    expect(div.nodeName).toEqual('DIV')
    expect(div.textContent).toEqual('Non-Custom')

    expect(console.error).toHaveBeenCalledTimes(3)
    const [firstError, secondError, thirdError] = console.error.mock.calls
    expect(firstError[0]).toMatch(/using uppercase HTML/)
    expect(secondError[0]).toMatch(/unrecognized in this browser/)
    expect(thirdError[0]).toMatch(/using uppercase HTML/)
  })

  it('passes bindings to children', () => {
    const { component } = render(
      <JsxParser
        bindings={{ foo: 'Foo', bar: 'Bar' }}
        components={{ Custom }}
        jsx={
          '<Custom bar="Baz"></Custom>' +
          '<div foo="Fu"></div>'
        }
      />
    )

    expect(component.ParsedChildren).toHaveLength(2)
    expect(component.ParsedChildren[0].props).toEqual({
      foo: 'Foo', // from `bindings`
      bar: 'Baz', // from jsx attributes (takes precedence)
    })

    // The <div> should receive `bindings`, too
    expect(component.ParsedChildren[1].props).toEqual({
      foo: 'Fu', // from jsx attributes (takes precedence)
      bar: 'Bar', // from `bindings`
    })
  })

  it('strips <script src="..."> tags by default', () => {
    const { component, rendered } = render(
      <JsxParser
        jsx={
          '<div>Before</div>' +
          '<script src="http://example.com/test.js"></script>' +
          '<div>After</div>'
        }
      />
    )

    expect(component.ParsedChildren).toHaveLength(2)
    expect(TestUtils.scryRenderedDOMComponentsWithTag(component, 'script')).toHaveLength(0)
    expect(rendered.childNodes).toHaveLength(2)
    expect(parent.getElementsByTagName('script')).toHaveLength(0)
  })

  it('strips <script>...</script> tags by default', () => {
    const { component, rendered } = render(
      <JsxParser
        jsx={
          '<div>Before</div>' +
          '<script>' +
            'window.alert("This shouldn\'t happen!");' +
          '</script>' +
          '<div>After</div>'
        }
      />
    )

    expect(component.ParsedChildren).toHaveLength(2)
    expect(TestUtils.scryRenderedDOMComponentsWithTag(component, 'script')).toHaveLength(0)
    expect(rendered.childNodes).toHaveLength(2)
    expect(parent.getElementsByTagName('script')).toHaveLength(0)
  })

  it('strips onEvent="..." attributes by default', () => {
    const { component, rendered } = render(
      <JsxParser
        jsx={
          '<div onClick="handleClick()">first</div>' +
          '<div onChange="handleChange()">second</div>'
        }
      />
    )

    expect(component.ParsedChildren).toHaveLength(2)
    expect(rendered.childNodes).toHaveLength(2)
    expect(component.ParsedChildren[0].props.onClick).toBeUndefined()
    expect(rendered.childNodes[0].attributes).toHaveLength(0)
    expect(component.ParsedChildren[1].props.onChange).toBeUndefined()
    expect(rendered.childNodes[1].attributes).toHaveLength(0)
  })

  it('parses childless elements with children = undefined', () => {
    const { component } = render(<JsxParser components={{ Custom }} jsx={'<Custom />'} />)

    expect(component.ParsedChildren).toHaveLength(1)
    expect(component.ParsedChildren[0].props.children).toBeUndefined()
  })

  it('parses bound object values', () => {
    const { component } = render(<JsxParser components={{ Custom }} jsx={'<Custom obj={{ foo: "bar" }} />'} />)

    expect(component.ParsedChildren).toHaveLength(1)
    expect(component.ParsedChildren[0].props.obj).toEqual({ foo: 'bar' })
  })

  it('strips custom blacklisted tags and attributes', () => {
    const { component, rendered } = render(
      <JsxParser
        blacklistedTags={['Foo']}
        blacklistedAttrs={['foo', 'prefixed[a-z]*']}
        jsx={
          '<div foo="bar" prefixedFoo="foo" prefixedBar="bar">first</div>' +
          '<Foo>second</Foo>'
        }
      />
    )

    expect(component.ParsedChildren).toHaveLength(1)
    expect(rendered.childNodes).toHaveLength(1)
    expect(component.ParsedChildren[0].props.foo).toBeUndefined()
    expect(component.ParsedChildren[0].props.prefixedFoo).toBeUndefined()
    expect(component.ParsedChildren[0].props.prefixedBar).toBeUndefined()
    expect(rendered.childNodes[0].attributes.foo).toBeUndefined()
    expect(rendered.childNodes[0].attributes.prefixedFoo).toBeUndefined()
    expect(rendered.childNodes[0].attributes.prefixedBar).toBeUndefined()
  })

  it('handles whitespace correctly', () => {
    const { rendered } = render(
      <JsxParser
        jsx={'\
          <h1>Title</h1>\
          <div class="foo">Bar</div>\
        '}
      />
    )

    // H1
    // Comment Whitespace Comment
    // DIV
    const children = Array.from(rendered.childNodes)
    expect(children).toHaveLength(3)

    const [h1, whitespace, div] = children
    expect(h1.nodeType).toEqual(Node.ELEMENT_NODE)
    expect(h1.nodeName).toEqual('H1')
    expect(h1.textContent).toEqual('Title')
    expect(whitespace.nodeType).toEqual(Node.TEXT_NODE)
    expect(whitespace.textContent).toMatch(/^\s+$/i)
    expect(div.nodeType).toEqual(Node.ELEMENT_NODE)
    expect(div.nodeName).toEqual('DIV')
    expect(div.textContent).toEqual('Bar')
    expect(div.className).toEqual('foo')
  })

  it('keeps non-breaking spaces as such', () => {
    const { rendered } = render(
      <JsxParser
        jsx={
          '<p>Contains a&nbsp;non-breaking space (html named entity)</p>' +
          '<p>Contains a&#160;non-breaking space (html numbered entity)</p>' +
          '<p>Contains a\u00a0non-breaking space (utf sequence)</p>' +
          '<p>Contains a non-breaking space (hard coded, using alt+space)</p>' +
          '<p>Contains a&#8239;narrow non-breaking space (html numbered entity)</p>' +
          '<p>Contains a\u202Fnarrow non-breaking space (utf sequence)</p>' +
          '<p>This is a test with regular spaces only</p>'
        }
      />
    )

    // Entites are converted to utf sequences
    // The first four paragraphs should contain \u00A0 (utf non-breaking space)
    // The two next paragraphs should contain \u202F (utf narrow non-breaking space)
    // The last paragraph should *not* contain any non breaking spaces
    const children = Array.from(rendered.childNodes)

    expect(children).toHaveLength(7)
    expect(children.every(c => c.nodeType === Node.ELEMENT_NODE))
    expect(children.every(c => c.nodeName === 'P'))

    const last = children.pop()
    expect(children.every(c => c.textContent.match(/[\u00A0]/)))
    expect(last.textContent).not.toMatch(/[\u00A0|\u202F]/)
  })

  it('handles style attributes gracefully', () => {
    const { rendered } = render(
      <JsxParser
        jsx={
          '<div style="margin: 0 1px 2px 3px;"></div>' +
          '<div style="padding-left: 45px; padding-right: 1em;"></div>'
        }
      />
    )

    expect(rendered.childNodes).toHaveLength(2)
  })

  it('handles implicit boolean props correctly', () => {
    const { component } = render(
      <JsxParser
        components={{ Custom }}
        jsx="<Custom shouldBeTrue shouldBeFalse={false} />"
      />
    )

    expect(component.ParsedChildren).toHaveLength(1)
    expect(component.ParsedChildren[0].props.shouldBeTrue).toBeTruthy()
    expect(component.ParsedChildren[0].props.shouldBeFalse).not.toBeTruthy()
  })

  it('does not render children for poorly formed void elements', () => {
    const { rendered } = render(
      <JsxParser
        jsx={
          '<img src="/foo.png">' +
            '<div class="invalidChild"></div>' +
          '</img>'
        }
      />
    )

    expect(rendered.childNodes).toHaveLength(1)
    expect(rendered.getElementsByTagName('img')).toHaveLength(1)
    expect(rendered.childNodes[0].innerHTML).toEqual('')
    expect(rendered.childNodes[0].childNodes).toHaveLength(0)

    expect(rendered.getElementsByTagName('div')).toHaveLength(0)
  })

  it('renders custom elements without requiring closing tags', () => {
    // eslint-disable-next-line react/prefer-stateless-function
    const CustomContent = () => <h1>Custom Content</h1>

    const { rendered } = render(
      <JsxParser
        components={{ CustomContent }}
        jsx="<CustomContent /><p>Text</p>"
      />
    )

    expect(rendered.childNodes).toHaveLength(2)
    expect(rendered.getElementsByTagName('p')).toHaveLength(1)

    expect(rendered.getElementsByTagName('h1')).toHaveLength(1)
    expect(rendered.getElementsByTagName('h1')[0].textContent).toEqual('Custom Content')
  })

  it('does render custom element without closing tag', () => {
    // eslint-disable-next-line react/prefer-stateless-function
    const CustomContent = () => <h1>Ipsum</h1>
    const CuStomContent = () => <h1>Lorem</h1>

    const { rendered } = render(
      <JsxParser
        components={{ CustomContent, CuStomContent }}
        jsx="<CustomContent /><CuStomContent />"
      />
    )

    expect(rendered.childNodes).toHaveLength(2)
    expect(rendered.getElementsByTagName('h1')).toHaveLength(2)
    expect(rendered.getElementsByTagName('h1')[0].textContent).toEqual('Ipsum')
    expect(rendered.getElementsByTagName('h1')[1].textContent).toEqual('Lorem')
  })

  it('skips over DOCTYPE, html, head, and div if found', () => {
    const { rendered } = render(
      <JsxParser jsx={'<!DOCTYPE html><html><head></head><body><h1>Test</h1><p>Another Text</p></body></html>'} />
    )

    expect(rendered.childNodes).toHaveLength(2)
  })

  it('outputs no wrapper element when renderInWrapper prop is false', () => {
    render(<JsxParser jsx={'<h1>Foo</h1><hr />'} renderInWrapper={false} />)
    expect(parent.childNodes).toHaveLength(2)

    const [h1, hr] = Array.from(parent.childNodes)
    expect([h1.nodeType, h1.nodeName, h1.textContent])
      .toEqual([Node.ELEMENT_NODE, 'H1', 'Foo'])
    expect([hr.nodeType, hr.nodeName]).toEqual([Node.ELEMENT_NODE, 'HR'])
  })

  // eslint-disable-next-line react/prop-types
  const OnlyOne = ({ children }) => (
    <div>{React.Children.only(children)}</div>
  )

  it('correctly interops with React.Children.only()', () => {
    expect(() => render(
      <JsxParser
        components={{ OnlyOne }}
        jsx={'<OnlyOne><h1>Ipsum</h1></OnlyOne>'}
      />
    )).not.toThrow()

    // Multiple children passed - should throw
    expect(() => render(
      <JsxParser
        components={{ OnlyOne }}
        jsx={'<OnlyOne><h1>Ipsum</h1><h1>Ipsum</h1></OnlyOne>'}
      />
    )).toThrow()
  })

  it('allows void-element named custom components to take children', () => {
    // eslint-disable-next-line react/prop-types
    const link = ({ to, children }) => (<a href={to}>{children}</a>)
    const { rendered } = render(<JsxParser components={{ link }} jsx={'<link to="/url">Text</link>'} />)
    expect(rendered.childNodes[0].nodeName).toEqual('A')
    expect(rendered.childNodes[0].textContent).toEqual('Text')
  })

  it('allows no-whitespace-element named custom components to take whitespace', () => {
    // eslint-disable-next-line react/prop-types
    const tr = ({ children }) => (<div className="tr">{children}</div>)
    const { rendered } = render(<JsxParser components={{ tr }} jsx={'<tr> <a href="/url">Text</a> </tr>'} />)
    expect(rendered.childNodes[0].nodeName).toEqual('DIV')
    expect(rendered.childNodes[0].childNodes).toHaveLength(3)

    const [space1, text, space2] = Array.from(rendered.childNodes[0].childNodes)
    const nodeTypes = [space1, text, space2].map(n => n.nodeType)
    expect(nodeTypes).toEqual([Node.TEXT_NODE, Node.ELEMENT_NODE, Node.TEXT_NODE])
    expect(space1.textContent).toEqual(' ')
    expect(text.textContent).toEqual('Text')
    expect(space2.textContent).toEqual(' ')
  })
})
