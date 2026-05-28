'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  Monitor, 
  Activity, 
  Settings, 
  Play, 
  Pause, 
  Square,
  Globe,
  Smartphone,
  Laptop,
  TrendingUp,
  Target,
  Users,
  BarChart3
} from 'lucide-react';
import { UnifiedMonitoringService } from '@/lib/unified-monitoring-service';

interface UnifiedAnalytics {
  totalDays: number;
  averageProductivityScore: number;
  totalActiveTime: number;
  totalFocusTime: number;
  totalMeetingTime: number;
  totalScreenshots: number;
  dailyMetrics: any[];
}

interface MonitoringData {
  isMonitoring: boolean;
  startTime?: string;
  stopTime?: string;
  screenshots: any[];
  activityData: any[];
  workStatus: string;
}

export function EnhancedDesktopMonitor() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData>({
    isMonitoring: false,
    screenshots: [],
    activityData: [],
    workStatus: 'working'
  });
  const [unifiedAnalytics, setUnifiedAnalytics] = useState<UnifiedAnalytics | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date()
  });

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.electron) {
      setIsElectron(true);
      
      // Listen for monitoring status changes
      window.electron.on('monitoring-status-changed', (data: any) => {
        setMonitoringData(prev => ({
          ...prev,
          isMonitoring: data.isMonitoring,
          startTime: data.startTime,
          stopTime: data.stopTime
        }));
      });

      // Listen for work status changes
      window.electron.on('work-status-changed', (status: string) => {
        setMonitoringData(prev => ({
          ...prev,
          workStatus: status
        }));
      });

      // Listen for new screenshots
      window.electron.on('screenshot-taken', (screenshot: any) => {
        setMonitoringData(prev => ({
          ...prev,
          screenshots: [...prev.screenshots, screenshot]
        }));
      });
    }

    // Load unified analytics
    loadUnifiedAnalytics();
  }, [dateRange]);

  const loadUnifiedAnalytics = async () => {
    try {
      setLoading(true);
      const service = UnifiedMonitoringService.getInstance();
      const analytics = await service.getUnifiedAnalytics(
        'current-user-id', // This should come from auth context
        dateRange.from,
        dateRange.to
      );
      setUnifiedAnalytics(analytics);
    } catch (error) {
      console.error('Error loading unified analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMonitoring = () => {
    if (isElectron && window.electron) {
      window.electron.send('start-monitoring');
    }
  };

  const handleStopMonitoring = () => {
    if (isElectron && window.electron) {
      window.electron.send('stop-monitoring');
    }
  };

  const handleWorkStatusChange = (status: string) => {
    if (isElectron && window.electron) {
      window.electron.send('update-work-status', status);
    }
  };

  const getWorkStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'break': return 'bg-yellow-500';
      case 'meeting': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Unified Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive view of desktop, browser, and mobile activity
          </p>
        </div>
        {isElectron && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleStartMonitoring}
              disabled={monitoringData.isMonitoring}
              variant="outline"
              size="sm"
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
            <Button
              onClick={handleStopMonitoring}
              disabled={!monitoringData.isMonitoring}
              variant="outline"
              size="sm"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Unified Analytics Overview */}
      {unifiedAnalytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productivity Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(unifiedAnalytics.averageProductivityScore)}%
              </div>
              <Progress 
                value={unifiedAnalytics.averageProductivityScore} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Average over {unifiedAnalytics.totalDays} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMinutes(unifiedAnalytics.totalActiveTime)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total active time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Focus Sessions</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMinutes(unifiedAnalytics.totalFocusTime)}
              </div>
              <p className="text-xs text-muted-foreground">
                Deep work time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Screenshots</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unifiedAnalytics.totalScreenshots}</div>
              <p className="text-xs text-muted-foreground">
                Desktop captures
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Current Session Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desktop Status</CardTitle>
            <Laptop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={monitoringData.isMonitoring ? "default" : "secondary"}
                className={monitoringData.isMonitoring ? "bg-green-500" : "bg-gray-500"}
              >
                {monitoringData.isMonitoring ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Work Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge 
                variant="outline"
                className={getWorkStatusColor(monitoringData.workStatus)}
              >
                {monitoringData.workStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Session Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monitoringData.startTime ? formatDuration(monitoringData.startTime) : '0h 0m'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-blue-100">
                <Laptop className="w-3 h-3 mr-1" />
                Desktop
              </Badge>
              <Badge variant="outline" className="bg-green-100">
                <Globe className="w-3 h-3 mr-1" />
                Browser
              </Badge>
              <Badge variant="outline" className="bg-purple-100">
                <Smartphone className="w-3 h-3 mr-1" />
                Mobile
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="desktop">Desktop</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unified Activity Overview</CardTitle>
              <CardDescription>
                Combined data from all monitoring sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading analytics...</p>
                </div>
              ) : unifiedAnalytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-700">
                        {unifiedAnalytics.totalDays}
                      </div>
                      <div className="text-sm text-blue-600">Days Tracked</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">
                        {formatMinutes(unifiedAnalytics.totalActiveTime)}
                      </div>
                      <div className="text-sm text-green-600">Active Time</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-700">
                        {formatMinutes(unifiedAnalytics.totalFocusTime)}
                      </div>
                      <div className="text-sm text-purple-600">Focus Time</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-700">
                        {formatMinutes(unifiedAnalytics.totalMeetingTime)}
                      </div>
                      <div className="text-sm text-orange-600">Meeting Time</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                  <p className="text-sm">Start monitoring to see unified analytics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="desktop" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Desktop Monitoring</CardTitle>
              <CardDescription>
                Real-time desktop activity and screenshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monitoringData.screenshots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No screenshots captured yet</p>
                  <p className="text-sm">Start monitoring to capture screenshots</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {monitoringData.screenshots.slice(-6).map((screenshot, index) => (
                    <div key={index} className="border rounded-lg p-2">
                      <img
                        src={screenshot.dataUrl}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(screenshot.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
              <CardDescription>
                In-depth productivity analysis and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unifiedAnalytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Productivity Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Active Time</span>
                          <span className="font-medium">
                            {formatMinutes(unifiedAnalytics.totalActiveTime)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Focus Time</span>
                          <span className="font-medium">
                            {formatMinutes(unifiedAnalytics.totalFocusTime)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Meeting Time</span>
                          <span className="font-medium">
                            {formatMinutes(unifiedAnalytics.totalMeetingTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Activity Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Days Tracked</span>
                          <span className="font-medium">{unifiedAnalytics.totalDays}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Screenshots</span>
                          <span className="font-medium">{unifiedAnalytics.totalScreenshots}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Score</span>
                          <span className="font-medium">
                            {Math.round(unifiedAnalytics.averageProductivityScore)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Status Controls</CardTitle>
              <CardDescription>
                Update your current work status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['working', 'break', 'meeting'].map((status) => (
                  <Button
                    key={status}
                    variant={monitoringData.workStatus === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleWorkStatusChange(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 