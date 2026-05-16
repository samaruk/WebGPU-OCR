
// Minimal grammar correction — capitalize first word, fix spaces

export class GrammarCorrector {
  correct(text) {
    if (!text) return text;
    // Remove double spaces
    let out = text.replace(/\s+/g, ' ').trim();
    // Capitalize after period
    out = out.replace(/([.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
    // Capitalize first letter
    out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  }
}
