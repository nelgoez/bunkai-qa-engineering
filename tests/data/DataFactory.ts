/**
 * KATA Architecture - Data Factory
 *
 * Generador centralizado de datos de prueba.
 * Regla de oro: NUNCA datos estáticos, siempre dinámicos con Faker.
 *
 * Acceso:
 *   - Desde componentes: this.data.createUser()
 *   - Import directo: import { DataFactory } from '@DataFactory'
 */

import type { TestCredentials, TestUser } from './types';

import { faker } from '@faker-js/faker';

export class DataFactory {
  // ============================================
  // SENTINEL — Fake/synthetic UUIDs for error-path testing
  // These are NOT test data — they're boundary markers (like 0, -1, null).
  // Use: DataFactory.SENTINEL.nonExistent, DataFactory.SENTINEL.fake, etc.
  // ============================================

  static SENTINEL = {
    /** Generic "does not exist" — use for 404/not-found assertions */
    nonExistent: '00000000-0000-0000-0000-000000000000',
    /** Alternate fake ID when two distinct non-existent values are needed */
    fake: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    /** Fake ATC ID from a foreign workspace (cross-workspace isolation tests) */
    foreignAtc: 'e7e3b1c4-5a6b-7c8d-9e0f-1a2b3c4d5e6f',
    /** Default placeholder ATC ID for Test builder payload construction */
    defaultAtc: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  } as const;

  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  private static uniqueId(): string {
    return `${Date.now()}-${faker.string.alphanumeric(6)}`;
  }

  private static testEmail(prefix = 'test'): string {
    const id = faker.string.alphanumeric(6).toLowerCase();
    const name = faker.person.firstName().toLowerCase();
    return `${prefix}.${name}.${id}@example.com`;
  }

  private static securePassword(): string {
    return `Test${faker.string.alphanumeric(8)}!`;
  }

  // ============================================
  // GENERADORES PRINCIPALES
  // ============================================

  /**
   * Genera un usuario completo para testing
   * @param overrides - Propiedades a sobreescribir
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    return {
      email: this.testEmail(),
      password: this.securePassword(),
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      ...overrides,
    };
  }

  /**
   * Genera solo credenciales (email + password)
   * @param overrides - Propiedades a sobreescribir
   */
  static createCredentials(overrides?: Partial<TestCredentials>): TestCredentials {
    return {
      email: this.testEmail(),
      password: this.securePassword(),
      ...overrides,
    };
  }

  /**
   * Genera un ID único para identificar datos de test
   * Útil para cleanup y trazabilidad
   */
  static createTestId(prefix = 'test'): string {
    return `${prefix}-${this.uniqueId()}`;
  }
}

export default DataFactory;
