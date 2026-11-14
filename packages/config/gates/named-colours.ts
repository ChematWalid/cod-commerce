/**
 * The CSS named colours (CSS Color 4), lower case. `transparent` and `currentcolor` are left out: neither paints a
 * fixed colour, so both are allowed next to the theme tokens.
 */
const NAMED_COLOURS: ReadonlySet<string> = new Set(
  [
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood',
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod',
    'darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon',
    'darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray',
    'dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green',
    'greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon',
    'lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon',
    'lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta',
    'maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen',
    'mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive',
    'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru',
    'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell',
    'sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise',
    'violet wheat white whitesmoke yellow yellowgreen',
  ]
    .join(' ')
    .split(' '),
);

/**
 * A CSS declaration: its property and its value. It starts after `{`, `;` or `}` (a declaration after a nested rule,
 * `a { b { … } color: red; }`), so selectors do not count. Properties match in any case (`COLOR: red`).
 */
const DECLARATION = /(?:^|[{;}])\s*([a-zA-Z-]+)\s*:([^;{}]*)/g;

/** Properties whose value may hold a colour: `color`, `background`, `border`, `border-top-color`, `box-shadow`… */
const COLOUR_PROPERTY =
  /(?:^|-)(?:color|background|border|outline|fill|stroke|shadow|decoration|caret|accent|rule)(?:-|$)/;

/** A custom property (`--brand: red`) would define a fixed palette of its own beside the theme tokens. */
const CUSTOM_PROPERTY = /^--/;

/** A bare word: not part of a custom property (`--red`), a longer name, a file name or a function call (`red(`). */
const BARE_WORD = /(?<![\w./-])[a-z]+(?![\w./(-])/gi;

/** Parts of a value that name a file or hold text, not a colour: `url(red.png)`, `"white"`. */
const URL_OR_STRING = /url\([^)]*\)|"[^"]*"|'[^']*'/gi;

/**
 * Tells whether a CSS property (kebab case) may take a colour: a colour property, or any custom property.
 *
 * @param property the property name
 * @returns true when a named colour in its value paints a fixed colour
 */
export function isColourProperty(property: string): boolean {
  const lower = property.toLowerCase();
  return CUSTOM_PROPERTY.test(lower) || COLOUR_PROPERTY.test(lower);
}

/**
 * Finds the named colours in one property value, leaving out `url(…)` arguments and quoted strings.
 *
 * @param value the value text, such as `1px solid red`
 * @returns each named colour as written
 */
export function findNamedColourWords(value: string): string[] {
  return [...value.replace(URL_OR_STRING, ' ').matchAll(BARE_WORD)]
    .map(([word]) => word)
    .filter((word) => NAMED_COLOURS.has(word.toLowerCase()));
}

/**
 * Tells whether a word is a CSS named colour (`red`, `Navy`), in any case.
 *
 * @param word the word
 * @returns true for a named colour other than `transparent` and `currentcolor`
 */
export function isNamedColour(word: string): boolean {
  return NAMED_COLOURS.has(word.toLowerCase());
}

/**
 * Finds the named colours (`red`, `white`, `rebeccapurple`) set by the colour and custom-property declarations of a
 * CSS source.
 *
 * @param css the CSS text, comments already removed
 * @returns each named colour as written, once per use
 */
export function findNamedCssColours(css: string): string[] {
  return [...css.matchAll(DECLARATION)]
    .filter(([, property = '']) => isColourProperty(property))
    .flatMap(([, , value = '']) => findNamedColourWords(value));
}
