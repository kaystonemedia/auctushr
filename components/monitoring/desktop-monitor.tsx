'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Monitor, Activity, Settings, Play, Pause, Square } from 'lucide-react';

interface MonitoringData {
  isMonitoring: boolean;
  startTime?: string;
  stopTime?: string;
  screenshots: any[];
  activityData: any[];
  workStatus: string;
}

export function DesktopMonitor() {
  const [monitoringData, setMonitoringData] = useState<MonitoringData>({
    isMonitoring: false,
    screenshots: [],
    activityData: [],
    workStatus: 'working'
  });
  const [isElectron, setIsElectron] = useState(false);

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
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Desktop Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor your work activity and productivity
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Screenshots</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monitoringData.screenshots.length}</div>
            <p className="text-xs text-muted-foreground">
              Captured today
            </p>
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
      </div>

      <Tabs defaultValue="screenshots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="screenshots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Screenshots</CardTitle>
              <CardDescription>
                Latest screen captures from your desktop
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

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Track your application usage and activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monitoringData.activityData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity data yet</p>
                  <p className="text-sm">Start monitoring to track activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {monitoringData.activityData.slice(-10).map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{activity.activeWindow?.title || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant="outline">{activity.workStatus}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Work Status</CardTitle>
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