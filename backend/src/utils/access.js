const PRIVILEGED_ROLES = ['doctor', 'admin'];

const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(role);

const ensureResourceAccess = (reqUser, resource, keys = []) => {
  if (!resource) {
    return false;
  }

  if (reqUser.role === 'admin') {
    return true;
  }

  return keys.some((key) => String(resource[key]?._id || resource[key]) === String(reqUser._id));
};

module.exports = {
  PRIVILEGED_ROLES,
  isPrivilegedRole,
  ensureResourceAccess,
};
