/**
 * Localized labels, each confirmed on a live Google result page (see tests/fixtures/labels-live.json).
 * Add a string here only after seeing it on a live page.
 */

/** Text of the heading that opens an AI Overview block. */
export const AI_OVERVIEW_LABELS: readonly string[] = [
  'AI Overview', // en
  'Übersicht mit KI', // de
  'Aperçu IA', // fr
  'AI による概要', // ja
  'نبذة باستخدام الذكاء الاصطناعي', // ar
  'Přehled od AI', // cs
  'AI-oversigt', // da
  'AI-oversikt', // nb
  'Επισκόπηση AI', // el
  'Visión general creada por IA', // es
  'AI-yhteenveto', // fi
  'תקציר מ-AI', // he
  'AI जवाब', // hi
  'AI-alapú áttekintés', // hu
  'Ringkasan AI', // id
  "Overview dell'AI", // it
  'AI 개요', // ko
  'AI-overzicht', // nl
  'Przegląd od AI', // pl
  'Visão geral criada por IA', // pt-BR
  'Rezumat generat de AI', // ro
  'Обзор от ИИ', // ru
  'AI-översikt', // sv
  'ข้อมูลภาพรวมโดย AI', // th
  'AI Bakışı', // tr
  'Огляд від ШІ', // uk
  'Thông tin tổng quan do AI tạo', // vi
  'AI 概览', // zh-CN
  'AI 摘要', // zh-TW
];

/** Text of the AI Mode tab / search-box button. */
export const AI_MODE_LABELS: readonly string[] = [
  'AI Mode', // en, it
  'KI‑Modus', // de (U+2011 non-breaking hyphen)
  'Mode IA', // fr
  'AI モード', // ja
  'وضع AI', // ar
  'Režim AI', // cs
  'AI-tilstand', // da
  'Modo IA', // es, pt-BR
  'Tekoälytila', // fi
  'מצב AI', // he
  'एआई मोड', // hi
  'AI-mód', // hu
  'Mode AI', // id
  'AI 모드', // ko
  'AI-modus', // nb, nl
  'Tryb AI', // pl
  'Modul AI', // ro
  'Режим ИИ', // ru
  'AI-läge', // sv
  'โหมด AI', // th
  'AI Modu', // tr
  'Режим ШІ', // uk
  'Chế độ AI', // vi
  'AI 模式', // zh-CN, zh-TW
];

/** Case-, width- and whitespace-insensitive form used for comparisons. */
export function normalizeLabel(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-') // every hyphen/dash variant (Google uses U+2011)
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function toSet(labels: readonly string[]): ReadonlySet<string> {
  return new Set(labels.map(normalizeLabel));
}

const OVERVIEW_SET = toSet(AI_OVERVIEW_LABELS);
const AI_MODE_SET = toSet(AI_MODE_LABELS);

export function isAiOverviewLabel(text: string | null | undefined): boolean {
  return !!text && OVERVIEW_SET.has(normalizeLabel(text));
}

export function isAiModeLabel(text: string | null | undefined): boolean {
  return !!text && AI_MODE_SET.has(normalizeLabel(text));
}
