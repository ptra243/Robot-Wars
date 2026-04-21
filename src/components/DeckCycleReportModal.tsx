import { useState } from 'react';
import type { DeckCycleReport, DeckCycleRoundSummary } from '../core/run';

interface DeckCycleReportModalProps {
  report: DeckCycleReport;
  onClose: () => void;
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(2);
}

function RoundDetail({ row }: { row: DeckCycleRoundSummary }) {
  const hasRounds = row.combatRoundsSpanned > 0;
  const dmgPerRoundThisPass = hasRounds ? row.damageDealt / row.combatRoundsSpanned : 0;
  const stallsPerRoundThisPass = hasRounds ? row.stalls / row.combatRoundsSpanned : 0;

  return (
    <div className="deck-cycle-round-detail">
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Damage / combat round (this pass)</span>
        <span title="Strike damage to the enemy, divided by combat rounds that started during this deck pass.">
          {hasRounds ? (
            <>
              {formatRate(dmgPerRoundThisPass)}{' '}
              <span className="deck-cycle-totals__hint">
                ({row.damageDealt} dmg ÷ {row.combatRoundsSpanned} rounds)
              </span>
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Stalls / combat round (this pass)</span>
        <span>
          {hasRounds ? (
            <>
              {formatRate(stallsPerRoundThisPass)}{' '}
              <span className="deck-cycle-totals__hint">
                ({row.stalls} stalls ÷ {row.combatRoundsSpanned} rounds)
              </span>
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Energy (charge)</span>
        <span>
          net {row.energyNet >= 0 ? '+' : ''}
          {row.energyNet} · spent ≈ {row.energySpent}
        </span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Junk</span>
        <span>
          net {row.junkNet >= 0 ? '+' : ''}
          {row.junkNet} · spent ≈ {row.junkSpent}
        </span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Refined scrap (core)</span>
        <span>
          net {row.coreNet >= 0 ? '+' : ''}
          {row.coreNet} · spent ≈ {row.coreSpent}
        </span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Damage dealt (Strike)</span>
        <span>{row.damageDealt}</span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Healing</span>
        <span>{row.healingDone}</span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Shield gained</span>
        <span>{row.shieldGained}</span>
      </div>
      <div className="deck-cycle-stat">
        <span className="deck-cycle-stat__label">Stalls</span>
        <span>{row.stalls}</span>
      </div>
      <div className="deck-cycle-buffs">
        <span className="deck-cycle-stat__label">Buffs / potency (from your resolves)</span>
        {row.buffsGenerated.length === 0 ? (
          <span> none</span>
        ) : (
          <ul>
            {row.buffsGenerated.map((b) => (
              <li key={`${row.passIndex}-${b.name}-${String(b.amount)}`}>
                {b.name}: {b.amount}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function DeckCycleReportModal({ report, onClose }: DeckCycleReportModalProps) {
  const [selectedRound, setSelectedRound] = useState(1);
  const summaries = report.roundSummaries;
  const active = summaries[selectedRound - 1];

  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <section className="card-modal card-modal--deck-cycle" onClick={(e) => e.stopPropagation()}>
        <h2>Deck cycle report</h2>
        <p className="card-modal-sub">
          Sim runs until your deck has wrapped <strong>{report.playerDeckCycles}</strong> time
          {report.playerDeckCycles === 1 ? '' : 's'} (full passes through the fatigue pile). That took{' '}
          <strong>{report.roundsSimulated}</strong> combat round
          {report.roundsSimulated === 1 ? '' : 's'} (each round is one player turn + one enemy turn). Using{' '}
          {report.activeQueueSlots} active queue slots.
        </p>
        <p className="card-modal-sub">
          {report.queueSource === 'planned' ? (
            <>
              Queue source: <strong>planned queue</strong> ({report.plannedSlotsFilled} card slots
              filled).
            </>
          ) : (
            <>
              Queue source: <strong>deck order</strong> — planned queue is empty, so slots are filled
              from your deck in order; any remaining slots count as Basic Strike (same as combat).
              Hand-only cards are not part of this until you use <strong>Load deck ← hand</strong>.
            </>
          )}
        </p>
        <p className="card-modal-sub card-modal-sub--queue">
          Simulated queue:{' '}
          {report.simulatedQueueSlotLabels.slice(0, report.activeQueueSlots).join(' → ')}
        </p>

        <div className="deck-cycle-totals">
          <div className="deck-cycle-totals__title">All deck passes combined</div>
          <div>
            <strong>Damage / combat round</strong>{' '}
            <span title="Total Strike damage ÷ combat rounds. Stalls still consume rounds, so this drops when the deck is slow or stalls often.">
              {formatRate(report.damagePerCombatRound)}
            </span>{' '}
            <span className="deck-cycle-totals__hint">
              ({report.damageDealt} dmg ÷ {report.roundsSimulated} rounds)
            </span>
          </div>
          <div>
            <strong>Stalls / combat round</strong> {formatRate(report.stallsPerCombatRound)} (
            {report.stalls} stalls ÷ {report.roundsSimulated} rounds)
          </div>
          <div>Damage dealt: {report.damageDealt}</div>
          <div>Healing done: {report.healingDone}</div>
          <div>Shield gained: {report.shieldGained}</div>
          <div>Stalls: {report.stalls}</div>
          <div>
            Buffs (combined):
            {report.buffsGenerated.length === 0 ? (
              ' none'
            ) : (
              <ul>
                {report.buffsGenerated.map((b) => (
                  <li key={`${b.name}-${String(b.amount)}`}>
                    {b.name}: {b.amount}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="deck-cycle-round-tabs" role="tablist" aria-label="Deck pass breakdown">
          {summaries.map((s) => (
            <button
              key={s.passIndex}
              type="button"
              role="tab"
              aria-selected={selectedRound === s.passIndex}
              className={`deck-cycle-round-tab${selectedRound === s.passIndex ? ' deck-cycle-round-tab--active' : ''}`}
              onClick={() => setSelectedRound(s.passIndex)}
            >
              Pass {s.passIndex}
            </button>
          ))}
        </div>
        <p className="card-modal-sub deck-cycle-round-hint">
          Pass 1 = first time through your deck; pass 2 and 3 = second and third full wraps. Damage per
          deck cycle alone ignores time — <strong>damage / combat round</strong> penalizes stalls and slow
          cycles. “Spent ≈” sums only decreases between snapshots on your resolves (before regains on the
          same card).
        </p>

        {active ? <RoundDetail row={active} /> : null}

        <div className="button-row">
          <button type="button" className="accent" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
