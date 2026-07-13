import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Unique,
} from 'typeorm'

@Entity('Roles')
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text')
    name: string

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @OneToMany(() => User, (user) => user.role)
    users: User[]
}

@Entity('Users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text', { unique: true })
    username: string

    @Column('text')
    first_name: string

    @Column('text')
    last_name: string

    @Column('text', { unique: true })
    email: string

    @Column('text', { nullable: true, unique: true })
    phone: string | null

    @Column('text')
    password: string

    @Column({ type: 'boolean', default: false })
    is_online: boolean

    @Column({ type: 'boolean', default: false })
    is_verified: boolean

    @Column({ type: 'boolean', default: false })
    is_otp_enabled: boolean

    @Column('text', { nullable: true })
    otp_base32: string | null

    @Column('text', { nullable: true })
    otp_auth_url: string | null

    @Column('text', { nullable: true })
    refresh_token: string | null

    @Column('text', { nullable: true })
    reset_token: string | null

    @Column('text', { nullable: true })
    verify_token: string | null

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @ManyToOne(() => Role, (role) => role.users, { nullable: true })
    @JoinColumn({ name: 'role_id' })
    role: Role | null

    @OneToMany(() => Todo, (todo) => todo.user)
    todos: Todo[]

    @OneToMany(() => Post, (post) => post.user)
    posts: Post[]

    @OneToMany(() => Comment, (comment) => comment.user)
    comments: Comment[]

    @OneToMany(() => Follow, (follow) => follow.follower)
    following: Follow[]

    @OneToMany(() => Follow, (follow) => follow.following)
    followers: Follow[]
}

@Entity('Todos')
export class Todo {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text')
    title: string

    @Column('text', { nullable: true })
    description: string

    @Column({ type: 'boolean', default: false })
    is_completed: boolean

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @ManyToOne(() => User, (user) => user.todos, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User
}

@Entity('Posts')
export class Post {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text')
    title: string

    @Column('text')
    content: string

    @Column('text', { nullable: true })
    imageUrl: string | null

    @Column({ type: 'boolean', default: false })
    is_paid: boolean

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @ManyToOne(() => User, (user) => user.posts, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User

    @OneToMany(() => Comment, (comment) => comment.post)
    comments: Comment[]
}

@Entity('Comments')
export class Comment {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text')
    content: string

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date

    @ManyToOne(() => User, (user) => user.comments, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User

    @ManyToOne(() => Post, (post) => post.comments, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'post_id' })
    post: Post
}

@Entity('Follows')
@Unique(['follower', 'following'])
export class Follow {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @ManyToOne(() => User, (user) => user.following, { nullable: false })
    @JoinColumn({ name: 'follower_id' })
    follower: User

    @ManyToOne(() => User, (user) => user.followers, { nullable: false })
    @JoinColumn({ name: 'following_id' })
    following: User

    @CreateDateColumn()
    createdAt: Date
}

@Entity('blacklisted_tokens')
export class BlacklistedToken {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column('text')
    token: string

    @Column('text')
    invalidatedAt: Date
}