import React from 'react';
import { EDU_TAGS, EDU_TAG_GROUPS, MAX_TAGS } from '../lib/eduTags';

/** Chip picker (0..MAX_TAGS tags). Controlled: value = array of tag ids. */
export default function TagPicker({ value, onChange, max = MAX_TAGS }) {
  const toggle = id => {
    if (value.includes(id)) onChange(value.filter(x => x !== id));
    else if (value.length < max) onChange([...value, id]);
  };
  return <fieldset className="edu-v3-tagpicker">
    <legend>Thẻ phân loại (tối đa {max}) · đã chọn {value.length}/{max}</legend>
    {Object.entries(EDU_TAG_GROUPS).map(([g, gl]) => <div className="edu-v3-tagrow" key={g}>
      <span>{gl}</span>
      <div>{EDU_TAGS.filter(t => t.group === g).map(t => {
        const on = value.includes(t.id);
        return <button type="button" key={t.id} aria-pressed={on} className={on ? 'active' : ''} disabled={!on && value.length >= max} onClick={() => toggle(t.id)}>{t.label}</button>;
      })}</div>
    </div>)}
  </fieldset>;
}
