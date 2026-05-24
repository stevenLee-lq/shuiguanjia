import type { UserType } from '../types.ts';

/**
 * 登录成功后应由管理端返回该账号的取水户类型。
 * 对接时请改为调用登录接口，从响应体读取 userType 等字段。
 *
 * 演示账号（与产品约定）：
 * - 公共供水户：test_user / 123456
 * - 自备水户：admin_water / 12345
 */
export async function loginResolveUserType(username: string, password: string): Promise<UserType> {
  await new Promise((r) => setTimeout(r, 120));
  const u = username.trim().toLowerCase();
  const pw = password;

  if (u === 'test_user') {
    if (pw !== '123456') {
      throw new Error('密码错误，演示账号为 123456');
    }
    return 'WATER_SAVING';
  }
  if (u === 'admin_water') {
    if (pw !== '12345') {
      throw new Error('密码错误，演示账号为 12345');
    }
    return 'SELF_PROVIDED';
  }

  // 无固定账号时：旧规则 / 默认可调
  if (u.startsWith('self_')) return 'SELF_PROVIDED';
  return 'WATER_SAVING';
}
