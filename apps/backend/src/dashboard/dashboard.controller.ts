import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('live')
  getLiveKpis() { return this.svc.getLiveKpis(); }

  @UseGuards(AuthGuard('jwt'))
  @Get('stock-chart')
  getStockChart() { return this.svc.getStockChart(); }

  @UseGuards(AuthGuard('jwt'))
  @Get('production-chart')
  getProductionChart() { return this.svc.getProductionChart(); }

  @UseGuards(AuthGuard('jwt'))
  @Get('qualite-chart')
  getQualiteChart() { return this.svc.getQualiteChart(); }

  @UseGuards(AuthGuard('jwt'))
  @Get('predictions')
  getPredictions() { return this.svc.getPredictions(); }
}
