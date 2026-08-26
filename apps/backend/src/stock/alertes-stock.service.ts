import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Module } from '@nestjs/common';

// ── Service Alertes Stock ─────────────────────────────────────────────────────
@Injectable()
export class AlertesStockService {
  private readonly logger = new Logger(AlertesStockService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ── US-035 : Générer les alertes stock (appelé par cron ou manuellement) ──
  async genererAlertes(): Promise<{ alertesCreees: number }> {
    const result = await this.dataSource.query(
      `SELECT fn_generer_alertes_stock() AS nb_alertes`
    );
    const nb = parseInt(result[0]?.nb_alertes || '0');
    this.logger.log(`Alertes stock générées : ${nb} nouvelles notifications`);
    return { alertesCreees: nb };
  }

  // ── Notifications non lues ─────────────────────────────────────────────────
  async getNotifications(userId: string, lue?: boolean) {
    let query = `
      SELECT * FROM notifications
      WHERE (destinataire = $1 OR destinataire IS NULL)
    `;
    const params: any[] = [userId];

    if (lue !== undefined) {
      query += ` AND lue = $2`;
      params.push(lue);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;
    return this.dataSource.query(query, params);
  }

  // ── Marquer une notification comme lue ────────────────────────────────────
  async marquerLue(notificationId: string, userId: string) {
    await this.dataSource.query(`
      UPDATE notifications
      SET lue = true, date_lecture = NOW()
      WHERE id = $1 AND (destinataire = $2 OR destinataire IS NULL)
    `, [notificationId, userId]);
    return { message: 'Notification marquée comme lue' };
  }

  // ── Marquer toutes comme lues ─────────────────────────────────────────────
  async marquerToutesLues(userId: string) {
    const result = await this.dataSource.query(`
      UPDATE notifications
      SET lue = true, date_lecture = NOW()
      WHERE (destinataire = $1 OR destinataire IS NULL) AND lue = false
    `, [userId]);
    return { message: 'Toutes les notifications marquées comme lues' };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  providers: [AlertesStockService],
  exports: [AlertesStockService],
})
export class AlertesStockModule {}
