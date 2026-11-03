import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { getErrorMessage, getFieldErrors } from '@/services/api';

/**
 * Maps a failed API call onto a react-hook-form: field-level validation errors
 * go to their fields, anything else becomes a root error message.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
) {
  const fieldErrors = getFieldErrors(error);
  let matched = false;
  for (const [path, message] of Object.entries(fieldErrors)) {
    if (fields.includes(path)) {
      setError(path as Path<T>, { type: 'server', message });
      matched = true;
    }
  }
  if (!matched) setError('root' as Path<T>, { type: 'server', message: getErrorMessage(error) });
}
