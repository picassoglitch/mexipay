import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
} from 'sequelize';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'mexipay',
  username: process.env.DB_USER ?? 'mexipay',
  password: process.env.DB_PASS ?? '',
  logging: (sql) => logger.debug('SQL', { sql }),
  pool: { max: 10, min: 2, acquire: 30_000, idle: 10_000 },
  define: { underscored: true, timestamps: true },
});

// ---------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------

export class Merchant extends Model<
  InferAttributes<Merchant>,
  InferCreationAttributes<Merchant>
> {
  declare id: CreationOptional<string>;
  declare businessName: string;
  declare email: string;
  /** Null for OAuth-only accounts */
  declare passwordHash: CreationOptional<string | null>;
  /** 'local' | 'google' | 'apple' */
  declare authProvider: CreationOptional<string>;
  /** Subject/sub from the OAuth provider — null for local accounts */
  declare oauthProviderId: CreationOptional<string | null>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Merchant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    businessName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING(72),
      allowNull: true,
    },
    authProvider: {
      type: DataTypes.STRING(16),
      defaultValue: 'local',
    },
    oauthProviderId: {
      type: DataTypes.STRING(256),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'merchants' },
);

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export type TransactionStatus = 'pending' | 'paid' | 'expired' | 'failed';

export class Transaction extends Model<
  InferAttributes<Transaction>,
  InferCreationAttributes<Transaction>
> {
  declare id: CreationOptional<string>;
  declare merchantId: ForeignKey<Merchant['id']>;
  /** Conekta order ID */
  declare conektaOrderId: string;
  /** Payment reference shown to payer */
  declare reference: string;
  /** CLABE to wire to — stored encrypted, never logged */
  declare clabeEncrypted: string;
  /** Amount in Mexican centavos (1 MXN = 100 centavos) */
  declare amountCentavos: number;
  /** Fee in centavos */
  declare feeCentavos: number;
  declare status: CreationOptional<TransactionStatus>;
  declare paidAt: CreationOptional<Date | null>;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    merchantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Merchant, key: 'id' },
    },
    conektaOrderId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    reference: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    clabeEncrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    amountCentavos: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    feeCentavos: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'expired', 'failed'),
      defaultValue: 'pending',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'transactions' },
);

// ---------------------------------------------------------------------------
// WebhookEvent  (deduplication log)
// ---------------------------------------------------------------------------

export class WebhookEvent extends Model<
  InferAttributes<WebhookEvent>,
  InferCreationAttributes<WebhookEvent>
> {
  declare id: CreationOptional<string>;
  /** Conekta event id — used for deduplication */
  declare eventId: string;
  declare eventType: string;
  declare payload: object;
  declare processedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
}

WebhookEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    eventType: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    processedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'webhook_events',
    updatedAt: false,
  },
);

// ---------------------------------------------------------------------------
// Associations
// ---------------------------------------------------------------------------

Merchant.hasMany(Transaction, { foreignKey: 'merchantId', as: 'transactions' });
Transaction.belongsTo(Merchant, { foreignKey: 'merchantId', as: 'merchant' });

// ---------------------------------------------------------------------------
// Sync helper (dev only)
// ---------------------------------------------------------------------------

export async function syncDatabase(force = false): Promise<void> {
  await sequelize.sync({ force });
  logger.info('Database synced', { force });
}
