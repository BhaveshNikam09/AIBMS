import React, { useState, useEffect } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';

export const TextScramble = ({ words, className = "" }) => {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(words[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [words]);

  useEffect(() => {
    let iteration = 0;
    const target = words[index];
    let interval = null;

    interval = setInterval(() => {
      setText(() => {
        return target.split('')
          .map((char, i) => {
            if (i < iteration) return target[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('');
      });

      if (iteration >= target.length) {
        clearInterval(interval);
        setText(target); // Ensure exactly target text at the end
      }
      
      iteration += 1 / 3;
    }, 30);

    return () => clearInterval(interval);
  }, [index, words]);

  return <span className={`inline-block tabular-nums ${className}`}>{text}</span>;
}
