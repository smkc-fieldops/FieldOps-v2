import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Clock } from '../../shared/clock/clock';
import { istDate, IST_TIME_ZONE } from '../../shared/clock/ist';
import { AppConfig } from '../../shared/config/app-config';
import { JobRunner } from '../../shared/jobs/job-runner';
import { AttendanceJobsService } from './attendance-jobs.service';
import { slotKey } from './jobs.policy';

/**
 * When the attendance jobs run. Every server instance fires these; JobRunner's database lock
 * lets one instance run each slot. Off when JOBS_ENABLED=false (tests call the jobs directly).
 */
@Injectable()
export class AttendanceScheduler {
  constructor(
    private readonly jobs: AttendanceJobsService,
    private readonly runner: JobRunner,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  @Cron('0 */30 * * * *', { name: 'attendance-auto-checkout' })
  autoCheckout(): Promise<void> {
    return this.run('auto-checkout', slotKey(this.clock.now(), 30), 25, () =>
      this.jobs.autoCheckout(),
    );
  }

  @Cron('0 5,20,35,50 * * * *', { name: 'attendance-silent-gaps' })
  silentGaps(): Promise<void> {
    return this.run('silent-gaps', slotKey(this.clock.now(), 15), 10, () =>
      this.jobs.detectSilentGaps(),
    );
  }

  @Cron('0 2,17,32,47 * * * *', { name: 'attendance-not-checked-in' })
  notCheckedIn(): Promise<void> {
    return this.run('not-checked-in', slotKey(this.clock.now(), 15), 10, () =>
      this.jobs.flagNotCheckedIn(),
    );
  }

  @Cron('0 10,40 * * * *', { name: 'attendance-day-close' })
  dayClose(): Promise<void> {
    return this.run('day-close', slotKey(this.clock.now(), 30), 25, () => this.jobs.closeDays());
  }

  // Nightly jobs fire three times; the lock runs each day once and retries a failed run.
  @Cron('0 30 1,3,5 * * *', { name: 'attendance-rollup', timeZone: IST_TIME_ZONE })
  rollUp(): Promise<void> {
    return this.run('nightly-rollup', istDate(this.clock.now()), 120, () => this.jobs.rollUp());
  }

  @Cron('0 30 2,4,6 * * *', { name: 'attendance-purge', timeZone: IST_TIME_ZONE })
  purge(): Promise<void> {
    return this.run('retention-purge', istDate(this.clock.now()), 120, () => this.jobs.purge());
  }

  private async run(
    name: string,
    runKey: string,
    maxMinutes: number,
    work: () => Promise<string>,
  ): Promise<void> {
    if (!this.config.jobs.enabled) return;
    try {
      await this.runner.run(name, runKey, maxMinutes, work);
    } catch {
      // JobRunner logged it and recorded FAILED; the next slot tries again.
    }
  }
}
