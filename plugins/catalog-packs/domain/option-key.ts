/** An option name or value as packs compare them (D2202): trimmed, NFC and lower case, so `Size ` is `size`. */
export const optionKey = (text: string): string => text.trim().normalize('NFC').toLowerCase();
