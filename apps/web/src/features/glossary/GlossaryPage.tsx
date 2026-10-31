import { useState, type FormEvent } from 'react';
import { useGlossary } from './use-glossary';

/** Glossary screen (US-09). Presentational; data and actions come from useGlossary. */
export function GlossaryPage() {
  const { items, loading, error, add, remove } = useGlossary();
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;
    await add({ term, translation: translation || null });
    setTerm('');
    setTranslation('');
  };

  return (
    <section>
      <h1>Thuật ngữ</h1>
      <form onSubmit={onSubmit}>
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Thuật ngữ" />
        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Cách dịch (tuỳ chọn)"
        />
        <button type="submit">Thêm</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id}>
              <strong>{t.term}</strong>
              {t.translation && <> — {t.translation}</>}
              <button onClick={() => void remove(t.id)}>Xoá</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
