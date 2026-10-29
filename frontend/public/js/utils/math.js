export const sum = (values) => values.reduce((total, value) => total + value, 0);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
