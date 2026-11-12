/**
 * Step 2 — S2 / S3 / S4 form sections with Smart Input Assistance.
 *
 * Each group exposes:
 *   sXSectionHtml({ initialData, isTh })      → markup for the section's fields (S3 funding lines stay in step2Stakeholders.js)
 *   bindSX(form, { initialData, isTh, onChange }) → wires dropdowns/chips/number inputs; returns { isValid(), collect() }
 *
 * collect() returns { data } (fields for the existing stakeholder columns) or { error: { msg, el } }.
 * No backend change is needed: everything maps onto columns added by migration 008.
 */

import { S2_ASSIST, S3_ASSIST, S4_ASSIST } from '../../config/stakeholderAssist.js';
import {
  fieldHtml,
  selectWithOtherHtml,
  bindSelectWithOther,
  bindChips,
  bindIntegerOnly,
  bindMoney,
  formatMoney,
  trackAuto,
  setAuto,
  setPlaceholder,
  setHint,
  pickText,
} from '../../components/smartAssist.js';
import { parseAmount } from '../../utils/stakeholderGroups.js';
import { escapeHtml as esc } from '../../utils/html.js';
import { optTag } from '../../utils/fieldTags.js';

const eg = (isTh, list) => `${isTh ? 'เช่น ' : 'e.g. '}${list.slice(0, 2).join(', ')}`;
const countAttrs = 'min="0" max="2000000000" step="1"';

/* ═════════════════════════════════ S2 ═════════════════════════════════ */

export function s2SectionHtml({ initialData: d, isTh }) {
  const c = S2_ASSIST;
  const L = (o) => pickText(o, isTh);
  return `
    ${selectWithOtherHtml({
      id: 's2Category',
      name: 'category_s2',
      label: isTh ? 'ประเภทผู้ดำเนินโครงการ' : 'Implementer Type',
      hint: L(c.hints.type),
      isTh,
      options: c.types,
      initialRaw: d?.category,
      placeholder: isTh ? '— เลือกประเภทผู้ดำเนินโครงการ —' : '— Select implementer type —',
      otherPlaceholder: isTh ? 'ระบุประเภท เช่น สมาคมวิชาชีพ' : 'Specify the type',
    })}
    ${fieldHtml({
      id: 's2NameInput',
      name: 'name_s2',
      label: isTh ? 'ชื่อบุคคลหรือหน่วยงานผู้ดำเนินโครงการ' : 'Implementer / Operator Name',
      required: true,
      hint: L(c.hints.name),
      isTh,
      value: d?.name || '',
      placeholder: L(c.placeholders.name),
      maxlength: 200,
      chipsLabel: isTh
        ? 'ตัวอย่างชื่อ (เลือกเพื่อเติมข้อความ และสามารถแก้ไขได้)'
        : 'Examples (tap to fill, editable)',
    })}
    ${fieldHtml({
      id: 's2OperationPeriod',
      name: 'operation_period',
      label: isTh ? 'ระยะเวลาในการดำเนินงาน' : 'Operating Timeline',
      hint: L(c.hints.period),
      isTh,
      value: d?.operation_period || '',
      placeholder: L(c.placeholders.period),
      maxlength: 500,
      chipsLabel: isTh ? 'ระยะเวลา' : 'Duration',
    })}
    <div class="form-row">
      ${fieldHtml({
        id: 's2PersonnelCount',
        name: 'estimated_count_s2',
        label: isTh ? 'จำนวนบุคลากรที่เข้าร่วม' : 'Personnel Count',
        hint: L(c.hints.count),
        isTh,
        type: 'number',
        inputmode: 'numeric',
        extraAttrs: countAttrs,
        value: d?.estimated_count ?? '',
        placeholder: L(c.placeholders.count),
      })}
      <div class="field">
        <label class="field-label" for="s2CountUnit">${isTh ? 'หน่วยนับ' : 'Unit'} ${optTag(isTh)}</label>
        <div class="smart-hint" id="s2CountUnitHint">${isTh ? 'ค่าเริ่มต้นคือ คน เปลี่ยนได้' : 'Defaults to people; change if needed.'}</div>
        <input list="s2UnitSuggestions" class="input" id="s2CountUnit" name="count_unit_s2" maxlength="50" aria-describedby="s2CountUnitHint"
          value="${esc(d?.count_unit || '')}" placeholder="${esc(L(c.placeholders.unit))}" />
        <datalist id="s2UnitSuggestions">${c.unitSuggestions.map((u) => `<option value="${esc(u)}"></option>`).join('')}</datalist>
      </div>
    </div>
    ${fieldHtml({
      id: 's2Role',
      name: 'role_in_project_s2',
      label: isTh ? 'บทบาทและหน้าที่ในโครงการ' : 'Role & Responsibility in Project',
      required: true,
      hint: L(c.hints.role),
      isTh,
      value: d?.role_in_project || '',
      placeholder: L(c.placeholders.role),
      maxlength: 500,
      chipsLabel: isTh
        ? 'บทบาทที่พบบ่อย (เลือกเพื่อเพิ่ม / เลือกอีกครั้งเพื่อนำออก)'
        : 'Common roles (tap to add / tap again to remove)',
    })}
    ${fieldHtml({
      id: 's2ResourcesUsed',
      name: 'resources_used',
      label: isTh ? 'ทรัพยากรหรือแรงงานที่ใช้ในการดำเนินโครงการ' : 'Resources & Labor Contributed',
      hint: L(c.hints.resources),
      isTh,
      tag: 'textarea',
      value: d?.resources_used || '',
      placeholder: L(c.placeholders.resources),
      maxlength: 2000,
      chipsLabel: isTh
        ? 'ตัวอย่างทรัพยากร (ใส่จำนวนเองได้)'
        : 'Resource examples (add quantities yourself)',
    })}
    ${fieldHtml({
      id: 's2Description',
      name: 'description_s2',
      label: isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details',
      hint: L(c.hints.description),
      isTh,
      tag: 'textarea',
      value: d?.description || '',
      placeholder: L(c.placeholders.description),
      maxlength: 2000,
    })}`;
}

export function bindS2(form, { initialData: d, isTh, onChange }) {
  const c = S2_ASSIST;
  const L = (o) => pickText(o, isTh);
  const el = (id) => form.querySelector(`#${id}`);
  const name = el('s2NameInput');
  const period = el('s2OperationPeriod');
  const count = el('s2PersonnelCount');
  const unit = el('s2CountUnit');
  const role = el('s2Role');
  const res = el('s2ResourcesUsed');
  const desc = el('s2Description');

  [name, period, unit, role].forEach(trackAuto);
  bindIntegerOnly(count);

  const nameChips = bindChips({
    container: el('s2NameInputChips'),
    input: name,
    isTh,
    mode: 'replace',
  });
  const periodChips = bindChips({
    container: el('s2OperationPeriodChips'),
    input: period,
    isTh,
    mode: 'replace',
  });
  const roleChips = bindChips({
    container: el('s2RoleChips'),
    input: role,
    isTh,
    mode: 'append',
    maxLen: 500,
  });
  const resChips = bindChips({
    container: el('s2ResourcesUsedChips'),
    input: res,
    isTh,
    mode: 'append',
    maxLen: 2000,
  });

  periodChips.setItems(c.periodChips);
  resChips.setItems(c.resourceChips);

  const type = bindSelectWithOther({
    select: el('s2Category'),
    other: el('s2CategoryOther'),
    tip: el('s2CategoryTip'),
    options: c.types,
    isTh,
    initialRaw: d?.category,
    onChange(opt, { initial }) {
      setPlaceholder(name, opt ? eg(isTh, opt.names) : L(c.placeholders.name));
      nameChips.setItems(opt ? opt.names : []);
      setPlaceholder(count, opt?.count?.ph || L(c.placeholders.count));
      setHint(el('s2PersonnelCountHint'), L(c.hints.count), opt?.count ? L(opt.count) : '');
      roleChips.setItems([...(opt?.roleExtras || []), ...c.roleChips]);
      // a suggested name only replaces an empty / still-auto-filled name, never text the user typed
      if (!initial) setAuto(name, opt?.defaultName || '');
      onChange?.();
    },
  });

  setAuto(unit, c.defaultUnit);
  type.apply(true);

  return {
    isValid: () => !!name.value.trim() && !!role.value.trim(),
    collect() {
      const nm = name.value.trim();
      if (!nm)
        return {
          error: {
            msg: isTh
              ? 'กรุณาระบุชื่อบุคคลหรือหน่วยงานผู้ดำเนินโครงการ'
              : 'Please enter the implementer name.',
            el: name,
          },
        };
      const rl = role.value.trim();
      if (!rl)
        return {
          error: {
            msg: isTh
              ? 'กรุณาระบุบทบาทและหน้าที่ในโครงการ'
              : 'Please specify the role in the project.',
            el: role,
          },
        };
      const cs = count.value.trim();
      const n = cs === '' ? null : Number(cs);
      if (n !== null && (!Number.isInteger(n) || n < 0)) {
        return {
          error: {
            msg: isTh
              ? 'จำนวนบุคลากรต้องเป็นจำนวนเต็ม 0 ขึ้นไป'
              : 'Personnel count must be a whole number (0 or more).',
            el: count,
          },
        };
      }
      return {
        data: {
          name: nm,
          category: type.value(),
          estimated_count: n,
          count_unit: unit.value.trim() || c.defaultUnit,
          role_in_project: rl,
          operation_period: period.value.trim() || null,
          resources_used: res.value.trim() || null,
          description: desc.value.trim() || null,
        },
      };
    },
  };
}

/* ═════════════════════════════════ S3 ═════════════════════════════════ */

export function s3SectionHtml({ initialData: d, isTh }) {
  const c = S3_ASSIST;
  const L = (o) => pickText(o, isTh);
  return `
    ${selectWithOtherHtml({
      id: 's3Category',
      name: 'category_s3',
      label: isTh ? 'ประเภทผู้สนับสนุน' : 'Supporter Type',
      hint: L(c.hints.type),
      isTh,
      options: c.types,
      initialRaw: d?.category,
      placeholder: isTh ? '— เลือกประเภทผู้สนับสนุน —' : '— Select supporter type —',
      otherPlaceholder: isTh ? 'ระบุประเภท เช่น สมาคมศิษย์เก่า' : 'Specify the type',
    })}
    ${fieldHtml({
      id: 's3NameInput',
      name: 'name_s3',
      label: isTh ? 'ชื่อบุคคลหรือหน่วยงานผู้สนับสนุน' : 'Supporter Name',
      required: true,
      hint: L(c.hints.name),
      isTh,
      value: d?.name || '',
      placeholder: L(c.placeholders.name),
      maxlength: 200,
      chipsLabel: isTh
        ? 'ตัวอย่างชื่อ (เลือกเพื่อเติมข้อความ และสามารถแก้ไขได้)'
        : 'Examples (tap to fill, editable)',
    })}
    ${selectWithOtherHtml({
      id: 's3SupportType',
      name: 'support_type',
      label: isTh ? 'รูปแบบการสนับสนุน' : 'Support Type',
      required: true,
      hint: L(c.hints.supportType),
      isTh,
      options: c.supportTypes,
      initialRaw: d?.support_type,
      placeholder: isTh ? '— เลือกรูปแบบการสนับสนุน —' : '— Select support type —',
      otherPlaceholder: isTh ? 'ระบุรูปแบบการสนับสนุน' : 'Specify the support type',
    })}
    <div class="form-row">
      ${fieldHtml({
        id: 's3SupportValue',
        name: 'support_value',
        label: isTh ? 'มูลค่าการสนับสนุน (บาท)' : 'Support Value (Baht)',
        hint: L(c.hints.value),
        isTh,
        inputmode: 'decimal',
        extraAttrs: 'autocomplete="off"',
        value: d?.support_value != null ? formatMoney(d.support_value) : '',
        placeholder: L(c.placeholders.value),
        after: `<div class="smart-example">${isTh ? 'ตัวอย่างรูปแบบ' : 'Format examples'}: ${c.valueExamples.join(' / ')} ${isTh ? 'บาท' : 'THB'}</div>`,
      })}
      ${fieldHtml({
        id: 's3SupportAmountOrQty',
        name: 'support_amount_or_quantity',
        label: isTh ? 'จำนวนเงินหรือปริมาณทรัพยากรที่สนับสนุน' : 'Amount / Resource Quantity',
        hint: L(c.hints.amount),
        isTh,
        value: d?.support_amount_or_quantity || '',
        placeholder: L(c.placeholders.amount),
        maxlength: 500,
      })}
    </div>
    ${fieldHtml({
      id: 's3Description',
      name: 'description_s3',
      label: isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details',
      hint: L(c.hints.description),
      isTh,
      tag: 'textarea',
      value: d?.description || '',
      placeholder: L(c.placeholders.description),
      maxlength: 2000,
      chipsLabel: isTh
        ? 'เงื่อนไขที่พบบ่อย (เลือกเพื่อเพิ่ม / เลือกอีกครั้งเพื่อนำออก)'
        : 'Common conditions (tap to add / remove)',
    })}`;
}

export function bindS3(form, { initialData: d, isTh, onChange }) {
  const c = S3_ASSIST;
  const L = (o) => pickText(o, isTh);
  const el = (id) => form.querySelector(`#${id}`);
  const name = el('s3NameInput');
  const value = el('s3SupportValue');
  const amount = el('s3SupportAmountOrQty');
  const desc = el('s3Description');

  [name, amount].forEach(trackAuto);
  bindMoney(value);

  const nameChips = bindChips({
    container: el('s3NameInputChips'),
    input: name,
    isTh,
    mode: 'replace',
  });
  const descChips = bindChips({
    container: el('s3DescriptionChips'),
    input: desc,
    isTh,
    mode: 'append',
    sep: '; ',
    maxLen: 2000,
  });
  descChips.setItems(c.detailChips);

  const type = bindSelectWithOther({
    select: el('s3Category'),
    other: el('s3CategoryOther'),
    tip: el('s3CategoryTip'),
    options: c.types,
    isTh,
    initialRaw: d?.category,
    onChange(opt, { initial }) {
      setPlaceholder(name, opt ? eg(isTh, opt.names) : L(c.placeholders.name));
      nameChips.setItems(opt ? opt.names : []);
      if (!initial) setAuto(name, opt?.defaultName || '');
      onChange?.();
    },
  });

  const support = bindSelectWithOther({
    select: el('s3SupportType'),
    other: el('s3SupportTypeOther'),
    tip: el('s3SupportTypeTip'),
    options: c.supportTypes,
    isTh,
    initialRaw: d?.support_type,
    onChange(opt) {
      // quantity example and value hint follow the support type; no value is ever filled in
      setPlaceholder(amount, opt?.amount?.ph || L(c.placeholders.amount));
      setHint(el('s3SupportAmountOrQtyHint'), L(c.hints.amount), opt?.amount ? L(opt.amount) : '');
      setHint(el('s3SupportValueHint'), L(c.hints.value), opt?.valueHint ? L(opt.valueHint) : '');
      onChange?.();
    },
  });

  type.apply(true);
  support.apply(true);

  return {
    isValid: () => !!name.value.trim() && !support.isEmpty(),
    collect() {
      const nm = name.value.trim();
      if (!nm)
        return {
          error: {
            msg: isTh
              ? 'กรุณาระบุชื่อบุคคลหรือหน่วยงานผู้สนับสนุน'
              : 'Please enter the supporter name.',
            el: name,
          },
        };
      if (support.isEmpty()) {
        return {
          error: {
            msg: isTh ? 'กรุณาเลือกรูปแบบการสนับสนุน' : 'Please select a support type.',
            el: el('s3SupportType'),
          },
        };
      }
      const v = parseAmount(value.value);
      if (v !== null && (Number.isNaN(v) || v < 0)) {
        return {
          error: {
            msg: isTh
              ? 'มูลค่าการสนับสนุนต้องเป็นตัวเลข 0 ขึ้นไป'
              : 'Support value must be 0 or greater.',
            el: value,
          },
        };
      }
      return {
        data: {
          name: nm,
          category: type.value(),
          support_type: support.value(),
          support_value: v,
          support_amount_or_quantity: amount.value.trim() || null,
          description: desc.value.trim() || null,
          count_unit: 'คณะ',
        },
      };
    },
  };
}

/* ═════════════════════════════════ S4 ═════════════════════════════════ */

export function s4SectionHtml({ initialData: d, isTh }) {
  const c = S4_ASSIST;
  const L = (o) => pickText(o, isTh);
  return `
    ${selectWithOtherHtml({
      id: 's4Category',
      name: 'category_s4',
      label: isTh ? 'ประเภทหน่วยงาน' : 'Agency Type',
      hint: L(c.hints.type),
      isTh,
      options: c.types,
      initialRaw: d?.category,
      placeholder: isTh ? '— เลือกประเภทหน่วยงาน —' : '— Select agency type —',
      otherPlaceholder: isTh ? 'ระบุประเภท เช่น ศูนย์พัฒนาครอบครัว' : 'Specify the type',
    })}
    ${fieldHtml({
      id: 's4NameInput',
      name: 'name_s4',
      label: isTh ? 'ชื่อหน่วยงานหรือกลุ่มบุคคล' : 'Agency / Partner Name',
      required: true,
      hint: L(c.hints.name),
      isTh,
      value: d?.name || '',
      placeholder: L(c.placeholders.name),
      maxlength: 200,
      chipsLabel: isTh
        ? 'ตัวอย่างชื่อ (เลือกเพื่อเติมข้อความ และสามารถแก้ไขได้)'
        : 'Examples (tap to fill, editable)',
    })}
    ${selectWithOtherHtml({
      id: 's4CooperationType',
      name: 'cooperation_type',
      label: isTh ? 'รูปแบบความร่วมมือ' : 'Collaboration Model',
      hint: L(c.hints.cooperation),
      isTh,
      options: c.cooperationTypes,
      initialRaw: d?.cooperation_type,
      placeholder: isTh ? '— เลือกรูปแบบความร่วมมือ —' : '— Select collaboration model —',
      otherPlaceholder: isTh ? 'ระบุรูปแบบความร่วมมือ' : 'Specify the collaboration',
      maxlength: 200,
    })}
    <div class="form-row">
      ${fieldHtml({
        id: 's4PersonnelCount',
        name: 'estimated_count_s4',
        label: isTh ? 'จำนวนผู้เกี่ยวข้อง' : 'Related People / Units',
        hint: L(c.hints.count),
        isTh,
        type: 'number',
        inputmode: 'numeric',
        extraAttrs: countAttrs,
        value: d?.estimated_count ?? '',
        placeholder: L(c.placeholders.count),
      })}
      <div class="field">
        <label class="field-label" for="s4CountUnit">${isTh ? 'หน่วยนับ' : 'Unit'} ${optTag(isTh)}</label>
        <div class="smart-hint" id="s4CountUnitHint">${isTh ? 'เปลี่ยนตามประเภทหน่วยงาน แก้ไขได้' : 'Follows the agency type; editable.'}</div>
        <input list="s4UnitSuggestions" class="input" id="s4CountUnit" name="count_unit_s4" maxlength="50" aria-describedby="s4CountUnitHint"
          value="${esc(d?.count_unit || '')}" placeholder="${esc(L(c.placeholders.unit))}" />
        <datalist id="s4UnitSuggestions">${c.unitSuggestions.map((u) => `<option value="${esc(u)}"></option>`).join('')}</datalist>
      </div>
    </div>
    ${fieldHtml({
      id: 's4Role',
      name: 'role_in_project_s4',
      label: isTh ? 'บทบาทในการมีส่วนร่วมกับโครงการ' : 'Role in Project Engagement',
      hint: L(c.hints.role),
      isTh,
      value: d?.role_in_project || '',
      placeholder: L(c.placeholders.role),
      maxlength: 500,
      chipsLabel: isTh
        ? 'บทบาทที่พบบ่อย (เลือกเพื่อเพิ่ม / เลือกอีกครั้งเพื่อนำออก)'
        : 'Common roles (tap to add / tap again to remove)',
    })}
    ${fieldHtml({
      id: 's4ResourcesProvided',
      name: 'resources_provided',
      label: isTh ? 'ทรัพยากรที่นำมาสนับสนุน' : 'Resources Provided',
      hint: L(c.hints.resources),
      isTh,
      tag: 'textarea',
      value: d?.resources_provided || '',
      placeholder: L(c.placeholders.resources),
      maxlength: 2000,
      chipsLabel: isTh
        ? 'ตัวอย่างทรัพยากร (ใส่จำนวนเองได้)'
        : 'Resource examples (add quantities yourself)',
    })}
    ${fieldHtml({
      id: 's4Description',
      name: 'description_s4',
      label: isTh ? 'รายละเอียดเพิ่มเติม' : 'Additional Details',
      hint: L(c.hints.description),
      isTh,
      tag: 'textarea',
      value: d?.description || '',
      placeholder: L(c.placeholders.description),
      maxlength: 2000,
    })}`;
}

export function bindS4(form, { initialData: d, isTh, onChange }) {
  const c = S4_ASSIST;
  const L = (o) => pickText(o, isTh);
  const el = (id) => form.querySelector(`#${id}`);
  const name = el('s4NameInput');
  const count = el('s4PersonnelCount');
  const unit = el('s4CountUnit');
  const role = el('s4Role');
  const res = el('s4ResourcesProvided');
  const desc = el('s4Description');

  [name, unit].forEach(trackAuto);
  bindIntegerOnly(count);

  const nameChips = bindChips({
    container: el('s4NameInputChips'),
    input: name,
    isTh,
    mode: 'replace',
  });
  const roleChips = bindChips({
    container: el('s4RoleChips'),
    input: role,
    isTh,
    mode: 'append',
    maxLen: 500,
  });
  const resChips = bindChips({
    container: el('s4ResourcesProvidedChips'),
    input: res,
    isTh,
    mode: 'append',
    maxLen: 2000,
  });
  roleChips.setItems(c.roleChips);
  resChips.setItems(c.resourceChips);

  const type = bindSelectWithOther({
    select: el('s4Category'),
    other: el('s4CategoryOther'),
    tip: el('s4CategoryTip'),
    options: c.types,
    isTh,
    initialRaw: d?.category,
    onChange(opt, { initial }) {
      setPlaceholder(name, opt ? eg(isTh, opt.names) : L(c.placeholders.name));
      nameChips.setItems(opt ? opt.names : []);
      setPlaceholder(count, opt?.count?.ph || L(c.placeholders.count));
      setHint(
        el('s4PersonnelCountHint'),
        L(c.hints.count),
        opt?.count ? `${L(opt.count)} — ${L(c.hints.count)}` : '',
      );
      if (!initial) {
        setAuto(name, opt?.defaultName || '');
        setAuto(unit, opt?.unit || c.defaultUnit);
      }
      onChange?.();
    },
  });

  const coop = bindSelectWithOther({
    select: el('s4CooperationType'),
    other: el('s4CooperationTypeOther'),
    tip: el('s4CooperationTypeTip'),
    options: c.cooperationTypes,
    isTh,
    initialRaw: d?.cooperation_type,
    onChange: () => onChange?.(),
  });

  setAuto(unit, type.option()?.unit || c.defaultUnit); // only fills an empty unit
  type.apply(true);
  coop.apply(true);

  return {
    isValid: () => !!name.value.trim(),
    collect() {
      const nm = name.value.trim();
      if (!nm)
        return {
          error: {
            msg: isTh ? 'กรุณาระบุชื่อหน่วยงานหรือกลุ่มบุคคล' : 'Please enter the agency name.',
            el: name,
          },
        };
      const cs = count.value.trim();
      const n = cs === '' ? null : Number(cs);
      if (n !== null && (!Number.isInteger(n) || n < 0)) {
        return {
          error: {
            msg: isTh
              ? 'จำนวนผู้เกี่ยวข้องต้องเป็นจำนวนเต็ม 0 ขึ้นไป หรือเว้นว่างไว้'
              : 'Count must be a whole number (0 or more), or left blank.',
            el: count,
          },
        };
      }
      return {
        data: {
          name: nm,
          category: type.value(),
          cooperation_type: coop.value(),
          estimated_count: n,
          count_unit: unit.value.trim() || c.defaultUnit,
          role_in_project: role.value.trim() || null,
          resources_provided: res.value.trim() || null,
          description: desc.value.trim() || null,
        },
      };
    },
  };
}
