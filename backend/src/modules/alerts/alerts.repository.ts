import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { Alert, AlertSeverity, AlertType } from './entities/alert.entity';

export interface AlertFilter {
  wardId?: string;
  /** Alerts about these people (an inspector's team); undefined = no restriction. */
  staffIds?: readonly string[];
  isResolved?: boolean;
  alertType?: AlertType;
  severity?: AlertSeverity;
  /** Inclusive UTC window on triggered_at. */
  from?: Date;
  to?: Date;
}

/** The only place that queries the alerts table. Pass `tx` inside a UnitOfWork. */
@Injectable()
export class AlertsRepository {
  constructor(@InjectRepository(Alert) private readonly repo: Repository<Alert>) {}

  private r(tx?: EntityManager): Repository<Alert> {
    return tx ? tx.getRepository(Alert) : this.repo;
  }

  findById(id: string): Promise<Alert | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByDedupeKey(dedupeKey: string): Promise<Alert | null> {
    return this.repo.findOne({ where: { dedupeKey } });
  }

  findPage(filter: AlertFilter, skip: number, take: number): Promise<[Alert[], number]> {
    const qb = this.repo.createQueryBuilder('a');
    if (filter.wardId) qb.andWhere('a.wardId = :wardId', { wardId: filter.wardId });
    if (filter.staffIds) {
      if (filter.staffIds.length === 0) qb.andWhere('1 = 0');
      else {
        // Chunks of 1000: Oracle's IN-list limit.
        const ids = filter.staffIds;
        qb.andWhere(
          new Brackets((w) => {
            for (let i = 0; i < ids.length; i += 1000) {
              w.orWhere(`a.staffId IN (:...s${i})`, { [`s${i}`]: ids.slice(i, i + 1000) });
            }
          }),
        );
      }
    }
    if (filter.isResolved !== undefined)
      qb.andWhere('a.isResolved = :r', { r: filter.isResolved ? 1 : 0 });
    if (filter.alertType) qb.andWhere('a.alertType = :t', { t: filter.alertType });
    if (filter.severity) qb.andWhere('a.severity = :sev', { sev: filter.severity });
    if (filter.from) qb.andWhere('a.triggeredAt >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('a.triggeredAt <= :to', { to: filter.to });
    return qb.orderBy('a.triggeredAt', 'DESC').skip(skip).take(take).getManyAndCount();
  }

  async insert(row: Alert, tx?: EntityManager): Promise<void> {
    await this.r(tx).insert(row);
  }

  /** Marks an open alert resolved. Returns rows updated: 0 = someone resolved it first. */
  async resolve(
    id: string,
    resolvedById: string | null,
    at: Date,
    note: string | null,
    tx?: EntityManager,
  ): Promise<number> {
    const result = await this.r(tx).update(
      { id, isResolved: false },
      { isResolved: true, resolvedAt: at, resolvedById, resolutionNote: note },
    );
    return result.affected ?? 0;
  }
}
