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

/** A CSS declaration (after `{` or `;`, so selectors do not count): its property and its value. */
const DECLARATION = /(?:^|[{;])\s*([a-z-]+)\s*:([^;{}]*)/g;

/** Properties whose value may hold a colour: `color`, `background`, `border`, `border-top-color`, `box-shadow`… */
const COLOUR_PROPERTY =
  /(?:^|-)(?:color|background|border|outline|fill|stroke|shadow|decoration|caret|accent|rule)(?:-|$)/;

/** A bare word: not part of a custom property (`--red`), a longer name or a function call (`red(`). */
const BARE_WORD = /(?<![\w-])[a-z]+(?![\w-(])/gi;

/**
 * Finds the named colours (`red`, `white`, `rebeccapurple`) set by the colour declarations of a CSS source.
 *
 * @param css the CSS text, comments already removed
 * @returns each named colour as written, once per use
 */
export function findNamedCssColours(css: string): string[] {
  return [...css.matchAll(DECLARATION)]
    .filter(([, property = '']) => COLOUR_PROPERTY.test(property))
    .flatMap(([, , value = '']) => [...value.matchAll(BARE_WORD)].map(([word]) => word))
    .filter((word) => NAMED_COLOURS.has(word.toLowerCase()));
}
