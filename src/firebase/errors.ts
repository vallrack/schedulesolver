export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    public context: SecurityRuleContext;

    constructor(context: SecurityRuleContext) {
        const message = `FirestoreError: Missing or insufficient permissions.`;
        super(message);
        this.name = 'FirestorePermissionError';
        this.context = context;
        console.error(message, JSON.stringify(context, null, 2));
    }
}
