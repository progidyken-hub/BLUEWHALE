import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBluewhaleValidation } from '@redishfish/bluewhale';

interface DepositFormValues {
  address: string;
  amount: string;
}

export default function App() {
  const [submitted, setSubmitted] = useState<DepositFormValues | null>(null);
  const validateAddress = useBluewhaleValidation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DepositFormValues>();

  const onSubmit = (values: DepositFormValues) => setSubmitted(values);

  return (
    <main>
      <h1>Stellar deposit</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label htmlFor="address">Destination address</label>
        <input
          id="address"
          autoComplete="off"
          aria-invalid={Boolean(errors.address)}
          aria-describedby={errors.address ? 'address-error' : undefined}
          {...register('address', {
            required: 'Enter a destination address.',
            validate: validateAddress,
          })}
        />
        {errors.address && (
          <p id="address-error" role="alert">
            {errors.address.message}
          </p>
        )}

        <label htmlFor="amount">Amount (XLM)</label>
        <input
          id="amount"
          type="number"
          min="0"
          step="any"
          {...register('amount', {
            required: 'Enter an amount.',
            validate: (amount) =>
              Number.isFinite(Number(amount)) && Number(amount) > 0
                ? true
                : 'Enter an amount greater than zero.',
          })}
        />
        {errors.amount && <p role="alert">{errors.amount.message}</p>}

        <button type="submit">Continue</button>
      </form>

      {submitted && (
        <p aria-live="polite">
          Ready to deposit {submitted.amount} XLM to {submitted.address}.
        </p>
      )}
    </main>
  );
}
