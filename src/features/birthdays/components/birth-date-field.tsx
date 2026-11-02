import { TextField } from '@/components/text-field';
import { formatBirthDateInput } from '@/features/birthdays/rules';

/** A date of birth typed as DD/MM/YYYY on the number pad; the slashes go in by themselves. */
export function BirthDateField({
  label = 'Date of birth',
  value,
  onChangeText,
  error,
  showError,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  showError?: boolean;
}) {
  return (
    <TextField
      label={label}
      placeholder="DD/MM/YYYY"
      value={value}
      onChangeText={(text) =>
        // Deleting a slash shouldn't put it straight back.
        onChangeText(
          text.length < value.length && value.endsWith('/') ? text : formatBirthDateInput(text),
        )
      }
      keyboardType="number-pad"
      autoComplete="birthdate-full"
      textContentType="birthdate"
      maxLength={10}
      error={error}
      showError={showError}
    />
  );
}
