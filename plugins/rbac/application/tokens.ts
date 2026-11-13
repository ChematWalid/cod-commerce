/** Injection token of the `ActivityLogPort` adapter. */
export const ACTIVITY_LOG: unique symbol = Symbol('RbacActivityLog');

/** Injection token of the `ClockPort`. */
export const CLOCK: unique symbol = Symbol('RbacClock');

/** Injection token of the `ActorDirectoryPort` adapter. */
export const ACTOR_DIRECTORY: unique symbol = Symbol('RbacActorDirectory');

/** Injection token of the `BusinessRoleRepositoryPort` adapter. */
export const BUSINESS_ROLES: unique symbol = Symbol('RbacBusinessRoles');

/** Injection token of the `RoleBindingRepositoryPort` adapter. */
export const ROLE_BINDINGS: unique symbol = Symbol('RbacRoleBindings');

/** Injection token of the `MemberAssignmentRepositoryPort` adapter. */
export const MEMBER_ASSIGNMENTS: unique symbol = Symbol('RbacMemberAssignments');

/** Injection token of the `EngineRolesPort` adapter. */
export const ENGINE_ROLES: unique symbol = Symbol('RbacEngineRoles');

/** Injection token of the `SessionFlusherPort` adapter. */
export const SESSION_FLUSHER: unique symbol = Symbol('RbacSessionFlusher');

/** Injection token of the `BusinessDirectoryPort` adapter. */
export const BUSINESS_DIRECTORY: unique symbol = Symbol('RbacBusinessDirectory');

/** Injection token of the `TransactionPort` adapter. */
export const TRANSACTION: unique symbol = Symbol('RbacTransaction');

/** Injection token of the `MemberSuspensionRegistry` that other plugins register their suspension checks on (D204). */
export const MEMBER_SUSPENSION_CHECK: unique symbol = Symbol('RbacMemberSuspensionCheck');

/** Injection token of the `RbacLockPort` adapter. */
export const RBAC_LOCK: unique symbol = Symbol('RbacLock');
