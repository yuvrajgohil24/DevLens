import { Request, Response } from 'express';
import prisma from '../db/prisma';

export async function getRiskTrends(req: Request, res: Response) {
  try {
    const { serviceId } = req.query;
    
    const whereClause = serviceId ? { serviceId: String(serviceId) } : {};
    
    // Fetch last 30 risk scores across the system or specific service
    const riskScores = await prisma.riskScore.findMany({
      where: whereClause,
      orderBy: { calculatedAt: 'asc' },
      take: 30,
      include: {
        service: { select: { name: true } },
      }
    });

    // Format for Recharts
    const data = riskScores.map(rs => ({
      date: rs.calculatedAt.toISOString().split('T')[0],
      score: Number(rs.score),
      service: rs.service.name,
      critical: rs.criticalCount,
      high: rs.highCount,
    }));

    return res.json({ data });
  } catch (err) {
    console.error('Failed to get risk trends:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMttr(req: Request, res: Response) {
  try {
    // In Phase 3, we mock MTTR until a resolved_at timestamp is added to Vulnerability schema
    const mockMttrData = [
      { month: 'Jan', mttrHours: 48 },
      { month: 'Feb', mttrHours: 42 },
      { month: 'Mar', mttrHours: 36 },
      { month: 'Apr', mttrHours: 28 },
      { month: 'May', mttrHours: 24.5 },
    ];
    
    return res.json({ 
      data: mockMttrData,
      current: 24.5,
      unit: 'hours',
      trend: -12.5 // percentage improvement
    });
  } catch (err) {
    console.error('Failed to get MTTR:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
