import { FormEvent, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';
import type { Community } from '../types/api';

export interface CommunityFormData {
  name: string;
  address: string;
  edrpou: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Community | null;
  onSubmit: (data: CommunityFormData) => Promise<void>;
}

export default function CommunityFormModal({
  open,
  onClose,
  initial,
  onSubmit,
}: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [edrpou, setEdrpou] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setAddress(initial?.address ?? '');
      setEdrpou(initial?.edrpou ?? '');
      setError(null);
      setBusy(false);
    }
  }, [open, initial]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        address: address.trim(),
        edrpou: edrpou.trim() || null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не вдалося зберегти';
      setError(msg);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Редагування спільноти' : 'Створення спільноти'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert tone="error" title="Помилка">
            {error}
          </Alert>
        )}
        <Input
          id="name"
          label="Назва"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="ОСББ «Вишневий 12»"
          maxLength={200}
        />
        <Input
          id="address"
          label="Адреса"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="вул. Вишнева 12, м. Київ"
          maxLength={500}
        />
        <Input
          id="edrpou"
          label="ЄДРПОУ"
          value={edrpou}
          onChange={(e) => setEdrpou(e.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric"
          placeholder="12345678"
          hint="Необов'язково. Рівно 8 цифр, якщо вказано"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Збереження…' : isEdit ? 'Зберегти' : 'Створити'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
