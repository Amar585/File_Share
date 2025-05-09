"use client"

import * as React from "react"
import { Bell, Globe, Key, Loader2, Lock, Monitor, Moon, Save, Shield, Sun, User } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { useUser } from "@/hooks/use-user"
import { useUserSettings } from "@/hooks/use-user-settings"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { PrivacySettingsRunner } from "@/components/privacy-settings-runner"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, profile, isLoading: userLoading, updateProfile } = useUser()
  const { 
    settings, 
    isLoading: settingsLoading, 
    updateFilePrivacySettings,
    updateNotificationSettings,
    updateLanguage,
    signOutFromAllDevices
  } = useUserSettings()
  
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [passwordChangeOpen, setPasswordChangeOpen] = React.useState(false)
  const [passwordData, setPasswordData] = React.useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    language: "english"
  })
  
  const [emailNotifications, setEmailNotifications] = React.useState(true)
  const [pushNotifications, setPushNotifications] = React.useState(true)
  const [privateFiles, setPrivateFiles] = React.useState(true)
  const [requireApproval, setRequireApproval] = React.useState(true)
  const [notificationTypes, setNotificationTypes] = React.useState({
    file_shared: true,
    file_downloaded: true,
    access_requested: true
  })

  // Whether privacy settings need initialization
  const [needsInitialization, setNeedsInitialization] = React.useState(false)

  // Initialize form with user data when it's loaded
  React.useEffect(() => {
    if (user && profile) {
      setFormData({
        name: profile.full_name || "",
        email: user.email || "",
        language: settings?.language || "english"
      });
    }
    
    if (settings) {
      setEmailNotifications(settings.email_notifications_enabled)
      setPushNotifications(settings.push_notifications_enabled)
      setPrivateFiles(settings.private_files_by_default)
      setRequireApproval(settings.require_approval_for_access)
      
      // Handle notification types from JSON
      if (settings.notification_types) {
        const types = settings.notification_types as Record<string, boolean>
        setNotificationTypes({
          file_shared: types.file_shared ?? true,
          file_downloaded: types.file_downloaded ?? true,
          access_requested: types.access_requested ?? true
        })
      }
    }
    
    // Check if privacy settings need initialization
    if (!settings && !userLoading && !settingsLoading && user) {
      setNeedsInitialization(true)
    } else {
      setNeedsInitialization(false)
    }
  }, [user, profile, settings, userLoading, settingsLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSaveGeneral = async () => {
    if (!user) return;
    
    setIsUpdating(true);
    try {
      const { error } = await updateProfile({
        full_name: formData.name,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw new Error(error);
      
      // Update language preference if changed
      if (settings?.language !== formData.language) {
        await updateLanguage(formData.language)
      }
      
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleSaveNotifications = async () => {
    setIsUpdating(true);
    try {
      await updateNotificationSettings(emailNotifications, pushNotifications, notificationTypes);
    } catch (error: any) {
      toast.error(error.message || "Failed to save notification settings");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleSavePrivacy = async () => {
    setIsUpdating(true);
    try {
      await updateFilePrivacySettings(privateFiles, requireApproval);
    } catch (error: any) {
      toast.error(error.message || "Failed to save privacy settings");
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      toast.success("Password updated successfully");
      setPasswordChangeOpen(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setIsUpdating(false);
    }
  };

  if (userLoading || settingsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>
          {needsInitialization && (
            <PrivacySettingsRunner />
          )}
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 md:w-auto">
            <TabsTrigger value="general">
              <User className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Monitor className="mr-2 h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="mr-2 h-4 w-4" />
              Privacy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Manage your basic account settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email} 
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    value={formData.language} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4" />
                          English
                        </div>
                      </SelectItem>
                      <SelectItem value="spanish">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4" />
                          Spanish
                        </div>
                      </SelectItem>
                      <SelectItem value="french">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4" />
                          French
                        </div>
                      </SelectItem>
                      <SelectItem value="german">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4" />
                          German
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveGeneral} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how FileShare looks on your device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <RadioGroup defaultValue={theme} onValueChange={(value) => setTheme(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="light" id="light" />
                      <Label htmlFor="light" className="flex items-center">
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dark" id="dark" />
                      <Label htmlFor="dark" className="flex items-center">
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="system" id="system" />
                      <Label htmlFor="system" className="flex items-center">
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => toast.success("Theme settings saved")}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Manage how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications on your device</p>
                  </div>
                  <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
                </div>
                <div className="space-y-2">
                  <Label>Notification Types</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="file-shared" 
                        checked={notificationTypes.file_shared}
                        onCheckedChange={(checked) => 
                          setNotificationTypes(prev => ({
                            ...prev,
                            file_shared: checked === true
                          }))
                        }
                      />
                      <Label htmlFor="file-shared">When someone shares a file with me</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="file-downloaded" 
                        checked={notificationTypes.file_downloaded}
                        onCheckedChange={(checked) => 
                          setNotificationTypes(prev => ({
                            ...prev,
                            file_downloaded: checked === true
                          }))
                        }
                      />
                      <Label htmlFor="file-downloaded">When someone downloads my file</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="access-requested" 
                        checked={notificationTypes.access_requested}
                        onCheckedChange={(checked) => 
                          setNotificationTypes(prev => ({
                            ...prev,
                            access_requested: checked === true
                          }))
                        }
                      />
                      <Label htmlFor="access-requested">When someone requests access to my file</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveNotifications} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Privacy & Security</CardTitle>
                <CardDescription>Manage your privacy and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="flex items-center space-x-2">
                    <Input type="password" value="••••••••••••" disabled className="flex-1" />
                    <Dialog open={passwordChangeOpen} onOpenChange={setPasswordChangeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Change</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Change Password</DialogTitle>
                          <DialogDescription>
                            Enter your current password and your new password.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input 
                              id="current-password" 
                              type="password" 
                              value={passwordData.currentPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input 
                              id="new-password" 
                              type="password"
                              value={passwordData.newPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input 
                              id="confirm-password" 
                              type="password"
                              value={passwordData.confirmPassword}
                              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setPasswordChangeOpen(false)}>Cancel</Button>
                          <Button onClick={handlePasswordChange} disabled={isUpdating}>
                            {isUpdating ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Key className="mr-2 h-4 w-4" />
                                Update Password
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>File Privacy</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="private-by-default"
                        checked={privateFiles}
                        onCheckedChange={(checked) => setPrivateFiles(checked === true)}
                      />
                      <Label htmlFor="private-by-default">Make all new files private by default</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="require-approval" 
                        checked={requireApproval}
                        onCheckedChange={(checked) => setRequireApproval(checked === true)}
                      />
                      <Label htmlFor="require-approval">Require approval for all access requests</Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Session Management</Label>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={signOutFromAllDevices}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Sign out from all devices
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSavePrivacy} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
