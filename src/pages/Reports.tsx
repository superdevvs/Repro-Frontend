
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermission";
import { Navigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";

// Monthly data
const revenueData = [
  { month: 'Jan', revenue: 4000 },
  { month: 'Feb', revenue: 3000 },
  { month: 'Mar', revenue: 2000 },
  { month: 'Apr', revenue: 2780 },
  { month: 'May', revenue: 1890 },
  { month: 'Jun', revenue: 2390 },
  { month: 'Jul', revenue: 3490 },
  { month: 'Aug', revenue: 4000 },
  { month: 'Sep', revenue: 5000 },
  { month: 'Oct', revenue: 6000 },
  { month: 'Nov', revenue: 4500 },
  { month: 'Dec', revenue: 3800 },
];

// Quarterly data
const quarterlyData = [
  { quarter: 'Q1', revenue: 9000, shoots: 45 },
  { quarter: 'Q2', revenue: 7060, shoots: 35 },
  { quarter: 'Q3', revenue: 12490, shoots: 62 },
  { quarter: 'Q4', revenue: 14300, shoots: 71 },
];

// Yearly data
const yearlyData = [
  { year: '2020', revenue: 35000, shoots: 175 },
  { year: '2021', revenue: 42000, shoots: 210 },
  { year: '2022', revenue: 48000, shoots: 240 },
  { year: '2023', revenue: 54000, shoots: 270 },
  { year: '2024', revenue: 30000, shoots: 150 },
];

// Monthly shoots data
const shootsData = [
  { month: 'Jan', shoots: 20 },
  { month: 'Feb', shoots: 15 },
  { month: 'Mar', shoots: 10 },
  { month: 'Apr', shoots: 14 },
  { month: 'May', shoots: 9 },
  { month: 'Jun', shoots: 12 },
  { month: 'Jul', shoots: 17 },
  { month: 'Aug', shoots: 20 },
  { month: 'Sep', shoots: 25 },
  { month: 'Oct', shoots: 30 },
  { month: 'Nov', shoots: 22 },
  { month: 'Dec', shoots: 19 },
];

// Photographer performance data
const photographerData = [
  { name: "John Doe", revenue: 12500, shoots: 65 },
  { name: "Jane Smith", revenue: 15800, shoots: 72 },
  { name: "Mike Brown", revenue: 9200, shoots: 43 },
  { name: "Sarah Johnson", revenue: 13400, shoots: 58 },
  { name: "David Lee", revenue: 8900, shoots: 36 },
];

// Service type data
const serviceData = [
  { name: "HDR Photos", value: 45, revenue: 4500 },
  { name: "Floor Plans", value: 20, revenue: 2000 },
  { name: "Video Tours", value: 15, revenue: 1500 },
  { name: "Drone Photography", value: 12, revenue: 1200 },
  { name: "Virtual Staging", value: 8, revenue: 800 },
];

// Colors for pie chart
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Reports() {
  const [timeframe, setTimeframe] = useState("monthly");
  const [reportType, setReportType] = useState("summary");
  const { role } = useAuth();
  const { can } = usePermission();
  const canViewReports = can('reports', 'view');
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || role === 'superadmin';
  
  // Only Super Admin can access Reports
  if (!canViewReports || !isSuperAdmin) {
    toast({
      title: "Access Denied",
      description: "Only Super Admin can access Reports.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  const getDataForTimeframe = (dataType: "revenue" | "shoots") => {
    switch (timeframe) {
      case "monthly":
        return dataType === "revenue" ? revenueData : shootsData;
      case "quarterly":
        return quarterlyData;
      case "yearly":
        return yearlyData;
      default:
        return dataType === "revenue" ? revenueData : shootsData;
    }
  };

  const getXAxisKey = () => {
    switch (timeframe) {
      case "monthly":
        return "month";
      case "quarterly":
        return "quarter";
      case "yearly":
        return "year";
      default:
        return "month";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          badge="Reports"
          title="Reports"
          description="Analytics and reporting for your photography business"
          action={
            <div className="flex flex-wrap gap-3">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="photographer">By Photographer</SelectItem>
                  <SelectItem value="service">By Service</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              {isAdmin && (
                <Button>
                  Export Report
                </Button>
              )}
            </div>
          }
        />

          {reportType === "summary" && (
            <Tabs defaultValue="revenue" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="shoots">Shoots</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue">
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Overview</CardTitle>
                    <CardDescription>
                      {timeframe === "monthly" && "Monthly revenue breakdown for the current year"}
                      {timeframe === "quarterly" && "Quarterly revenue breakdown for the current year"}
                      {timeframe === "yearly" && "Yearly revenue breakdown for the past 5 years"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={getDataForTimeframe("revenue")}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={getXAxisKey()} />
                        <YAxis tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value) => `$${value}`} />
                        <Legend />
                        <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shoots">
                <Card>
                  <CardHeader>
                    <CardTitle>Shoots Overview</CardTitle>
                    <CardDescription>
                      {timeframe === "monthly" && "Monthly shoots breakdown for the current year"}
                      {timeframe === "quarterly" && "Quarterly shoots breakdown for the current year"}
                      {timeframe === "yearly" && "Yearly shoots breakdown for the past 5 years"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={getDataForTimeframe("shoots")}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={getXAxisKey()} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="shoots" stroke="#6366f1" name="Number of Shoots" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {reportType === "photographer" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Photographer Revenue</CardTitle>
                  <CardDescription>
                    Revenue by photographer for the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={photographerData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip formatter={(value) => `$${value}`} />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Photographer Shoot Count</CardTitle>
                  <CardDescription>
                    Number of shoots completed by photographer
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={photographerData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} />
                      <Tooltip />
                      <Bar dataKey="shoots" fill="#6366f1" name="Number of Shoots" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {reportType === "service" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Services Breakdown</CardTitle>
                  <CardDescription>
                    Distribution of services provided
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={serviceData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {serviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} shoots`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Services Revenue</CardTitle>
                  <CardDescription>
                    Revenue generated by service type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={serviceData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip formatter={(value) => `$${value}`} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
}
