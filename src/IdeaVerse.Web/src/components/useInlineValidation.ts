import { useEffect, useRef, useState, type FormEvent } from 'react';

/** Checks one field's current value and says what is wrong with it, or nothing when it is fine. */
type Check = () => string | undefined;

/**
 * The app's own form validation, in place of the browser's bubbles (forms using it set `noValidate`). Every field is
 * checked when the form is submitted and the first one with a problem is focused. From then on every field is checked
 * again as it changes, so a message clears while the user corrects it, before they reach for the button, and nothing
 * moves under the pointer. Show `errors[field]` in the field's `Field` error slot so it is announced with it.
 */
export function useInlineValidation<K extends string>(checks: Record<K, Check>) {
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const focusIn = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    focusIn.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    focusIn.current = null;
  }, [attempts]);

  const errors: Partial<Record<K, string>> = {};
  if (submitted) {
    for (const field of Object.keys(checks) as K[]) {
      errors[field] = checks[field]();
    }
  }

  /** Checks every field of the form being submitted, shows what is wrong, and says whether the form can be sent. */
  const validate = (event: FormEvent) => {
    const valid = (Object.keys(checks) as K[]).every((field) => !checks[field]());
    focusIn.current = !valid && event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null;
    setSubmitted(true);
    setAttempts((count) => count + 1);
    return valid;
  };

  /** A blur handler for the field; its message already follows every change once the form has been submitted. */
  const blur = (field: K) => () => {
    void field;
  };

  /** Clears every message, such as after the form is sent and emptied. */
  const reset = () => setSubmitted(false);

  return { errors, validate, blur, reset };
}

/** Says what is wrong with an email address, if anything; `missing` is the message for an empty one. */
export function emailProblem(email: string, missing = 'Enter your email address.'): string | undefined {
  if (!email.trim()) {
    return missing;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address, like name@company.com.';
}

/** A check that the value is not empty, with the message to show when it is. */
export function requiredProblem(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}
