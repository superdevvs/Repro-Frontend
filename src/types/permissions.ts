
export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface Resource {
  id: string;
  name: string;
  description: string;
}

export interface Action {
  id: string;
  name: string;
  description: string;
}

export interface PermissionRule {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: string;
  permissions: PermissionRule[];
}

export type PermissionsMap = Record<string, RolePermissions>;

export interface PermissionRoleMeta {
  id: string;
  label: string;
  description: string;
  locked?: boolean;
}

export interface PermissionCatalogItem {
  id: string;
  resource: string;
  action: string;
  label: string;
  description: string;
  defaultRoles: string[];
}

export interface PermissionCatalogGroup {
  id: string;
  label: string;
  description: string;
  permissions: PermissionCatalogItem[];
}

export type RolePermissionIdsMap = Record<string, string[]>;

export interface AdminPermissionsResponse {
  roles: PermissionRoleMeta[];
  catalog: PermissionCatalogGroup[];
  permissions: RolePermissionIdsMap;
  defaults: RolePermissionIdsMap;
}

export interface CurrentUserPermissionsResponse {
  role: string;
  secondaryRoles: string[];
  permissionIds: string[];
  permissions: PermissionRule[];
}
